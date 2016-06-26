'use strict';
let Enumerable = (function() {
    // Private constant variables for module
    let FOR_EACH_ACTION_STACK_REF = function(arr) {
        return arr;
    };
    let InvalidItem;
	
    // Private Classes for module
	function Reconstructable(){
		let Arguments = Array.from(arguments);
		this.Reconstruct = function(){
		  return Reflect.construct(this.constructor,Arguments);
		}
	}
    function GroupInternal(key) {
        this.Key = key;
        this.Items = [];
    }
	function Group(key,data){
		this.Key = key;
		this.Items = ParseDataAsEnumerable(data);
	}
	function Range(min,max){
		this.Min = min;
		this.Max = max;
	}
	function KeyValuePair(key,value){
		this.Key = key;
		this.Value = value;
	}
	function Joining(left, right) {
		this.Left = left;
		this.Right = right;
	}
    function HashMap(pred) {
        this.Hash = new Map();
        this.Predicate = pred;
        let scope = this;
        this.ExtractValue = function(obj) {
            if (scope.Predicate) {
                return scope.Predicate(obj);
            }
            return obj;
        }
        this.Contains = function(obj) {
            let val = this.ExtractValue(obj);
            return this.Hash.has(val);
        }
        this.ContainsFromExtractedValue = function(val) {
            return this.Hash.has(val);
        }
        this.TryAdd = function(obj) {
            let val  = this.ExtractValue(obj);
			if(this.Hash.has(val)){
				return undefined;
			}
			this.Hash.set(val,obj);
			return val;
        }
		this.Delete = function(obj){
            let val  = this.ExtractValue(obj);
			this.Hash.delete(val);			
		}
        this.GetHashKeyOrInsertNew = function(obj) {
            let val  = this.ExtractValue(obj);
			if(this.Hash.has(val)){
				return val;
			}
			this.Hash.set(val,obj);
			return val;
        }

        // Flushes the hash and outputs as array
        this.Flush = function() {
            let rtn = Array.from(this.Hash.values());
            this.Clear();
            return rtn;
        }

        this.Clear = function() {
            scope.Hash.clear();
        }
    }
	function NestedSet(model){
		this.Model = model;
		this.Keys = Object.keys(this.Model);
		const len = this.Keys.length;
		const breakPt = len-1;
		this.Map = new Map();
		this.has = function(obj){
			return this.get(obj) !== undefined;
		}
		this.get = function(obj){
			let map = this.Map;
			for(let i = 0; i < len; i++){
				let key = this.Keys[i];
				let val = obj[key];
				if(map.has(val)){
					if(i === breakPt){
						return map.get(val);
					}
					map = map.get(val);
				} else {
					return undefined;
				}
			}
			return undefined;			
		}
		this.add = function(obj,saveVal){
			let map = this.Map;
			for(let i = 0; i < len; i++){
				let key = this.Keys[i];
				let val = obj[key];
				if(map.has(val) === false){
					if(i === breakPt){
						map.set(val,saveVal);
						return;
					} else {
						map.set(val, new Map());
						map = map.get(val);
					}
				} else {
					if(i === breakPt){
						return;
					} else {
						map = map.get(val);
					}
				}
			}
		}
		this.clear = function(){
			this.Map.clear();
		}
	}
    
	function EnumeratorItem(val,done){
		this.Value = val;
		this.Done = done;
	}
	function Enumerator(data){
		this.Data = data;
		this.Index = -1;
		this.Current = undefined;
		this.Done = false;
	}
	Enumerator.prototype.Next = function(){
		if(this.Index >= this.Data.length){
			this.Done = true;
			this.Current = undefined;
			return new EnumeratorItem(undefined,true);
		}
		this.Index++;
		let done = this.Index >= this.Data.length;
		this.Done = done;
		this.Current = this.Data[this.Index];
		return new EnumeratorItem(this.Current,done);
	}
	function LazyEnumerator(data){
		this.Data = data.Data;
		this.Enumerable = data.Clone();
		this.Index = -1;
		this.Current = undefined;
		this.Done = false;
	}	
	LazyEnumerator.prototype.Next = function(){
		if(this.Index === -1){
            this.Data = this.Enumerable.ForEachActionStack[this.Enumerable.ForEachActionStack.length - 1](this.Data);		
		}
		if(this.Index >= this.Data.length){
			ResetPredicates(this.Enumerable.Predicates);
			return new EnumeratorItem(undefined,true);
		}
		let item = InvalidItem;
		while(item === InvalidItem){
			this.Index++;
			if(this.Index >= this.Data.length){
				this.Current = undefined;
				this.Done = true;
				ResetPredicates(this.Enumerable.Predicates);
				return new EnumeratorItem(undefined,true);
			}			
			item = this.Data[this.Index];
			for (let j = 0, len2 = this.Enumerable.Predicates.length; j != len2; j++) {
				let Predicate = this.Enumerable.Predicates[j];
				item = Predicate.Execute(item);
				if (item === InvalidItem) {
					break;
				}
			}
			if (item === InvalidItem) {
				continue;
			}
			let done = this.Index >= this.Data.length;
			this.Done = done;
			this.Current = item;
			return new EnumeratorItem(item,done);			
        }
	}	
	function IteratorEnumerator(iterator){
		this.Iterator = iterator;
		this.Index = -1;
		this.Current = undefined;
		this.Done = false;
	}
	IteratorEnumerator.prototype.Next = function(){
		if(this.Done === true){
			return new EnumeratorItem(this.Current,this.Done);
		}
		let next = this.Iterator.next();
		this.Done = next.done;
		this.Current = next.value;
		return new EnumeratorItem(this.Current,this.Done);		
	} 
	function MapEnumerator(source){
		this.Data = source;
		this.Index = -1;
		this.Current = undefined;
		this.Done = false;	
		this.KeyIterator;
	}
	MapEnumerator.prototype.Next = function(){
		if(this.Index === -1){
			this.KeyIterator = new IteratorEnumerator(this.Data.keys());
		}
		if(this.Done === true){
			return new EnumeratorItem(this.Current,this.Done);
		}
		this.Index++;
		let next = this.KeyIterator.Next();
		if(next.Value === undefined){
			this.Current = undefined;
			this.Done = true;
			return new EnumeratorItem(this.Current,this.Done);
		}
		
		this.Done = next.Done;
		let val = this.Data.get(next.Value);
		this.Current = new KeyValuePair(next.Value, val);
		return new EnumeratorItem(this.Current,this.Done);		
	}
 	
    // Private functions across module
    function ParseDataAsArray(data) {
        if (data.hasOwnProperty("length")) {
            return data;
        }
        if (data.ToArray !== undefined) {
            return data.ToArray();
        }
        return Array.from(data);
    }
    function ParseDataAsEnumerable(data) {
        if (data.hasOwnProperty("length")) {
            return new Enumerable({
                Data: data
            });
        }
		// This supports Enumerable,Dictionary,and Lookup
        if (data.ToEnumerable !== undefined) {
            return data.ToEnumerable();
        }

		return new Enumerable({
			Data: Array.from(data)
		});

    }
	function ExtendPrototype(child,parent){
		let oldConstructor = child.constructor;
		child = Object.create(parent);
		child.constructor = oldConstructor;
	}
	function CreateDataForNewEnumerable(enumerable){
		let scope = enumerable;
		let dataToPass = {
			Data: scope.Data,
			Predicates: ReconstructPredicates(scope.Predicates),
			ForEachActionStack: scope.ForEachActionStack
		};	
		return dataToPass;
	}
    function ResetPredicates(Predicates) {
        for (let i = 0; i < Predicates.length; i++) {
            let pred = Predicates[i];
            pred.Reset();
        }
    }
	function ReconstructPredicates(Predicates){
		let rtn = [];
		for(let i = 0; i < Predicates.length; i++){
			rtn.push( Predicates[i].Reconstruct() );
		}
		return rtn;
	}
    function ProcessPredicatesNoReturn(Predicates, data, terminatingCondition) {
        ResetPredicates(Predicates);

        // No action was specified
        if (!terminatingCondition) {
            return;
        }

        let idx = -1;
        for (let len = data.length, i = 0; i !== len; i++) {
            let item = data[i];
            for (let j = 0, len2 = Predicates.length; j != len2; j++) {
                let Predicate = Predicates[j];
                item = Predicate.Execute(item);
                if (item === InvalidItem) {
                    break;
                }
            }
            if (item === InvalidItem) {
                continue;
            }
            idx++;
            if (terminatingCondition(idx, item) === false) {
                return;
            }

        }
        ResetPredicates(Predicates);
        return;
    }

	// the module API
    function PublicEnumerable(data) {
        let d = ParseDataAsArray(data);
        return new Enumerable({
            Data: d
        });
    }
   // The private constructor. Define EVERYTHING in here
    let Enumerable = function(privateData) {
        let scope = this;
		
        // Private methods for module
        scope.AddToForEachStack = function(action) {
            let oldFeA = scope.ForEachActionStack[scope.ForEachActionStack.length - 1];
            let oldPredicate = scope.Predicates.slice();
            scope.Predicates = [];
            let newFeA = function(arr) {
                let newArr = oldFeA(arr);
                newArr = scope.ProcessPredicates(oldPredicate, newArr);
                newArr = action(newArr);
                return newArr;
            }
            scope.ForEachActionStack.push(newFeA);
        }
        scope.AddToPredicateStack = function(pred) {
            scope.Predicates.push(pred);
        }
        scope.ProcessPredicates = function(Predicates, data) {
                ResetPredicates(Predicates);

                if (Predicates.length === 0) {
                    return data;
                }

                let arr = [];
                let idx = -1;
                for (let len = data.length, i = 0; i !== len; i++) {
                    let item = data[i];
                    for (let j = 0, len2 = Predicates.length; j != len2; j++) {
                        let Predicate = Predicates[j];
                        item = Predicate.Execute(item);
                        if (item === InvalidItem) {
                            break;
                        }
                    }
                    if (item !== InvalidItem) {
                        arr.push(item);
                    }
                }
                ResetPredicates(Predicates);
                return arr;
            }
            // Private variables for module
		scope.Data = [];
		if(privateData.Data !== undefined){
			scope.Data = privateData.Data.slice();
		}
        scope.Predicates = [];
        if (privateData.Predicates) {
            scope.Predicates = privateData.Predicates.slice();
        }
        scope.ForEachActionStack = [FOR_EACH_ACTION_STACK_REF];
        if (privateData.ForEachActionStack) {
            scope.ForEachActionStack = privateData.ForEachActionStack.slice();
        }
        if (privateData.NewForEachAction) {
            scope.AddToForEachStack(privateData.NewForEachAction);
        }
        if (privateData.NewPredicate) {
            scope.AddToPredicateStack(privateData.NewPredicate);
        }
	}

		Enumerable.prototype.GetEnumerator = function(){
			return new LazyEnumerator(this);
		}
		Enumerable.prototype[Symbol.iterator] = function () {
				let enumerator = this.GetEnumerator();
				return {
					next: () => {
						enumerator.Next();
						return { value: enumerator.Current, done: enumerator.Done };
					}
				};
		}
		
        Enumerable.prototype.IsInvalidItem = function(item) {
            return item == InvalidItem;
        }
        Enumerable.prototype.ToEnumerable = function() {
            return this.Clone();
        }
        Enumerable.prototype.ToArray = function() {
            let arr = this.Data;
            arr = this.ForEachActionStack[this.ForEachActionStack.length - 1](arr);
            arr = this.ProcessPredicates(this.Predicates, arr);
            return arr;
        }
		Enumerable.prototype.ToReadOnlyArray = function() {
			let scope = this;
			let arr = scope.ToArray();
			Object.freeze(arr);
			return arr;
		}
        Enumerable.prototype.ToDictionary = function(predKey, predVal) {
            let arr = this.ToArray();
            let rtn = new Dictionary();
            for (let i = 0; i < arr.length; i++) {
                let item = arr[i];
                let key = predKey(item);
                let val = predVal(item);
                rtn.Add(key,val);
            }
            return rtn;
		}
         Enumerable.prototype.ToLookup = function(predKey, predVal) {
            let arr = this.ToArray();
            let rtn = new Lookup();
            for (let i = 0; i < arr.length; i++) {
                let item = arr[i];
                let key = predKey(item);
                let val = predVal(item);
                rtn.Add(key,val);
            }
            return rtn;
        }
		
        Enumerable.prototype.ForEach = function(action) {
            let arr = this.Data;
            arr = this.ForEachActionStack[this.ForEachActionStack.length - 1](arr);
            ProcessPredicatesNoReturn(this.Predicates, arr, action);
            return;
        }

        let WherePredicate = function(pred) {
			Reconstructable.apply(this,arguments);
            this.Predicate = pred;
            let scope = this;
            this.Execute = function(item) {
                let passed = this.Predicate(item);
                if (passed) {
                    return item;
                }
                return InvalidItem;
            }
            this.Reset = function() {}
        }
        Enumerable.prototype.Where = function(pred) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            if (pred === undefined) {
                pred = function(item) {
                    return true;
                }
            }
            data.WherePredicate = new WherePredicate(pred);
            return new FilteredEnumerable(data);
        }
        let SelectPredicate = function(pred) {
			Reconstructable.apply(this,arguments);
            this.Predicate = pred;
            this.Execute = function(item) {
                return this.Predicate(item)
            }
            this.Reset = function() {}
        }
        Enumerable.prototype.Select = function(pred) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewPredicate = new SelectPredicate(pred);
            return new Enumerable(data);
        }
        Enumerable.prototype.SelectMany = function(pred, selectPred) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = function(arr) {
                let sPred = new SelectPredicate(pred);
                let rtn = [];
                for (let i = 0; i < arr.length; i++) {
                    let item = arr[i];
                    let selected = sPred.Execute(item);
                    selected = ParseDataAsArray(selected);
                    for (let j = 0; j < selected.length; j++) {
                        let jItem = selected[j];
                        let converted = selectPred(item, jItem);
                        rtn.push(converted);
                    }
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        let DistinctPredicate = function(pred) {
 			Reconstructable.apply(this,arguments);           
			this.Hash = new HashMap(pred);
            this.Predicate = function(item) {
                // returns undefined in failed, otherwise returns the item
                let result = this.Hash.TryAdd(item);
                return result;
            }
            this.Execute = function(item) {
                return this.Predicate(item)
            }
            this.Reset = function() {
                this.Hash.Clear();
            }
        }
        Enumerable.prototype.Distinct = function(pred) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            let distinctHash = [];
            data.NewPredicate = new DistinctPredicate(pred);
            return new Enumerable(data);
        }
        let SkipPredicate = function(cnt) {
 			Reconstructable.apply(this,arguments);           
			this.Skipped = 0;
            this.SkipCount = cnt;
            this.Predicate = function(item) {
                if (this.Skipped < this.SkipCount) {
                    this.Skipped++;
                    return InvalidItem;
                }
                return item;
            }
            this.Execute = function(item) {
                return this.Predicate(item)
            }
            this.Reset = function() {
                this.Skipped = 0;
            }
        }
        Enumerable.prototype.Skip = function(cnt) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewPredicate = new SkipPredicate(cnt);
            return new Enumerable(data);
        }
        let SkipWhilePredicate = function(pred) {
  			Reconstructable.apply(this,arguments);         
		   this.CanSkip = true;
            this._predicate = pred;
            this.Predicate = function(item) {
                if (!this.CanSkip) {
                    return item;
                }
                this.CanSkip = pred(item);
                if (this.CanSkip) {
                    return InvalidItem;
                }
                return item;
            }
            this.Execute = function(item) {
                return this.Predicate(item)
            }
            this.Reset = function() {
                this.CanSkip = true;
            }
        }
        Enumerable.prototype.SkipWhile = function(pred) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewPredicate = new SkipWhilePredicate(pred);
            return new Enumerable(data);
        }
        let TakePredicate = function(cnt) {
 			Reconstructable.apply(this,arguments);
            this.Took = 0;
            this.TakeCount = cnt;
            this.Predicate = function(item) {
                if (this.Took >= this.TakeCount) {
                    return InvalidItem;
                }
                this.Took++;
                return item;
            }
            this.Execute = function(item) {
                return this.Predicate(item)
            }
            this.Reset = function() {
                this.Took = 0;
            }
        }
        Enumerable.prototype.Take = function(cnt) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewPredicate = new TakePredicate(cnt);
            return new Enumerable(data);
        }
        let TakeWhilePredicate = function(pred) {
 			Reconstructable.apply(this,arguments);
            this.CanTake = true;
            this._predicate = pred;
            this.Predicate = function(item) {
                if (!this.CanTake) {
                    return InvalidItem;
                }
                this.CanTake = pred(item);
                if (!this.CanTake) {
                    return InvalidItem;
                }
                return item;
            }
            this.Execute = function(item) {
                return this.Predicate(item)
            }
            this.Reset = function() {
                this.CanTake = true;
            }
        }
       Enumerable.prototype.TakeWhile = function(pred) {
		   let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewPredicate = new TakeWhilePredicate(pred);
            return new Enumerable(data);
        }
        Enumerable.prototype.TakeExceptLast = function(cnt) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            cnt = cnt || 1;
            data.NewForEachAction = function(arr) {
                let newArr = [];
                let take = arr.length - cnt;
                for (let i = 0; i < take; i++) {
                    newArr.push(arr[i]);
                }
                return newArr;
            }
            return new Enumerable(data);
        }
        Enumerable.prototype.TakeLast = function(cnt) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = function(arr) {
                let rtn = [];
                let idx = arr.length;
                let took = 0;
                let willTake = Math.min(cnt, arr.length);
                while (took < cnt || idx > 0) {
                    idx--;
                    took++;
                    let item = arr[idx];
                    let rtnIdx = willTake - took;
                    rtn[rtnIdx] = item;
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        Enumerable.prototype.TakeLastWhile = function(pred) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = function(arr) {
                let rtn = [];
                let idx = arr.length;
                while (idx > 0) {
                    idx--;
                    let item = arr[idx];
                    if (!pred(item)) {
                        break;
                    }
                    rtn.push(item);
                }
                return rtn.reverse();
            }
            return new Enumerable(data);
        }
        let FirstPredicate = function(pred) {
 			Reconstructable.apply(this,arguments);
            let SCOPE = this;
            this.NULL_PRED_METHOD = function(i, v) {
                SCOPE._first = v;
                return false;
            }
            this.PRED_METHOD = function(i, v) {
                if (SCOPE._predicate(v)) {
                    SCOPE._first = v;
                    SCOPE._firstIndex = i;
                    return false;
                }
            }
            this._predicate = pred;
            this._first = null;
            this._firstIndex = -1;
            let that = this;
            if (this._predicate == null) {
                this.Predicate = this.NULL_PRED_METHOD;
            } else {
                this.Predicate = this.PRED_METHOD;
            }
            this.Execute = function(SCOPE) {
                SCOPE.ForEach(this.Predicate);
                let idx = this._firstIndex;
                let first = this._first;
                return {
                    Index: idx,
                    First: first
                };
            }
            this.Reset = function() {
                this._first = null;
                this._firstIndex = -1;
            }
        }
        Enumerable.prototype.First = function(pred) {
			let scope = this;
            let p = new FirstPredicate(pred);
            return p.Execute(scope).First;
        }
        Enumerable.prototype.Single = function(pred) {
			let scope = this;
            return scope.First(pred);
        }
        let LastPredicate = function(pred) {
			Reconstructable.apply(this,arguments);
            this.Predicate = pred;
            this._last = null;
            this._lastIndex = -1;
            this.Execute = function(SCOPE) {
                let arr = SCOPE.ToArray();
                let idx = arr.length - 1;
                if (this.Predicate == null) {
                    return arr[idx];
                }
                while (idx > -1) {
                    let item = arr[idx];
                    if (this.Predicate(item)) {
                        this._last = item;
                        this._lastIndex = idx;
                        break;
                    }
                    idx--;
                }
                idx = this._lastIndex;
                last = this._last;
                return {
                    Index: idx,
                    Last: last
                };
            }
            this.Reset = function() {
                this._last = null;
                this._lastIndex = -1;
            }
        }
        Enumerable.prototype.Last = function(pred) {
			let scope = this;
            let p = new LastPredicate(pred);
            return p.Execute(scope).Last;
        }
        Enumerable.prototype.IndexOf = function(item) {
			let scope = this;
            let pred = function(x) {
                return x === item;
            }
            let p = new FirstPredicate(pred);
            return p.Execute(scope).Index;
        }
        Enumerable.prototype.LastIndexOf = function(item) {
			let scope = this;
            let arr = scope.ToArray();
            return arr.lastIndexOf(item);
        }
        Enumerable.prototype.OrderBy = function(pred) {
			let scope = this;
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack,
                Descending: false,
                SortComparer: pred
            };
            return new OrderedEnumerable(data);
        }
        Enumerable.prototype.OrderByDescending = function(pred) {
			let scope = this;
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack,
                Descending: true,
                SortComparer: pred
            };
            return new OrderedEnumerable(data);
        }
        Enumerable.prototype.Any = function(pred) {
			let scope = this;
            let first = scope.First(pred);
            return first !== null;
        }
        let AllPredicate = function(pred) {
 			Reconstructable.apply(this,arguments);
           this._predicate = pred;
            this._all = true;
            let scope = this;
            this.Predicate = function(i, v) {
                if (scope._predicate(v) === false) {
                    scope._all = false;
                    return false;
                }
            }
            this.Execute = function(SCOPE) {
                SCOPE.ForEach(this.Predicate);
                return this._all;
            }
            this.Reset = function() {
                this._all = true;
            }
        }
        Enumerable.prototype.All = function(pred) {
			let scope = this;
            if (pred == null) {
                return true;
            }
            let p = new AllPredicate(pred);
            return p.Execute(scope);
        }
        Enumerable.prototype.Not = function(pred) {
			let scope = this;
            return scope.Where(x => !pred(x));
        }
        let UnionPredicate = function(items, pred, pred2) {
			Reconstructable.apply(this,arguments);
            let scope = this;
            this.Items = items;
            this.Predicate = pred || function(x){return x;}
			this.Predicate2 = pred2 || function(x){return x;}
            this.Reset = function() {}
            this.Execute = function(arr) {
                let items = ParseDataAsArray(scope.Items);
                let hash = new HashMap(pred);
                for (let i = 0; i < arr.length; i++) {
                    let item = arr[i];
                    hash.TryAdd(item);
                }
				let rtn = [];
				let hash2 = new HashMap(pred2);
				
                for (let i = 0; i < items.length; i++) {
                    let item = items[i];
					let val = this.Predicate2(item);
					if(hash.ContainsFromExtractedValue(val) === false){
						let v = hash2.TryAdd(item);
						if(v !== undefined){
							rtn.push(item);
						}
					}
                }
                let flush = hash.Flush();
				flush = flush.concat(rtn);
                return flush;
            }
        }
        Enumerable.prototype.Union = function(items, pred, pred2) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = function(arr) {
                let p = new UnionPredicate(items, pred, pred2);
                return p.Execute(arr);
            }
            return new Enumerable(data);
        }
        let IntersectPredicate = function(items, pred, pred2) {
 			Reconstructable.apply(this,arguments);
           let scope = this;
            this.Items = items;
            this.Predicate = pred || function(x){return x;}
			this.Predicate2 = pred2 || function(x){return x;}
            this.Reset = function() {}
            this.Execute = function(arr) {
                let rtn = [];
                let items = ParseDataAsArray(scope.Items);
                let hash1 = new HashMap(pred);
                let hash2 = new HashMap(pred2);
                for (let i = 0; i < arr.length; i++) {
                    let item = arr[i];
                    hash1.TryAdd(item);
                }
                for (let i = 0; i < items.length; i++) {
                    let item = items[i];
                    let val = hash2.ExtractValue(item);

                    if (hash2.ContainsFromExtractedValue(val)) {
                        continue;
                    }
                    if (hash1.ContainsFromExtractedValue(val) === false) {
                        continue;
                    }
                    hash2.TryAdd(item);
                    rtn.push(item);
                }
                hash1.Clear();
                hash2.Clear();
                return rtn;
            }
        }
        Enumerable.prototype.Intersect = function(items, pred, pred2) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = function(arr) {
                let p = new IntersectPredicate(items, pred, pred2);
                return p.Execute(arr);
            }
            return new Enumerable(data);
        }
        let DisjointPredicate = function(items, pred, pred2) {
 			Reconstructable.apply(this,arguments);
           let scope = this;
            this.Items = items;
            this.Predicate = pred || function(x){return x;}
			this.Predicate2 = pred2 || function(x){return x;}
            this.Reset = function() {}
            this.Execute = function(arr) {
				let setA = arr;
				let setB = ParseDataAsArray(items);
				let rtn = []
				let hash = new HashMap(pred);
				for(let i = 0; i < setA.length; i++){
				   let item = setA[i];
					hash.TryAdd(item);
				}

				for(let i=0; i < setB.length;i++){
				   let item = setB[i];
				   let val = this.Predicate2(item);
				   if(hash.ContainsFromExtractedValue(val) === false){
					   rtn.push(item);
				   }
				}

				hash = new HashMap(pred2);
				for(let i = 0; i < setB.length; i++){
				   let item = setB[i];
				  hash.TryAdd(item);
				}

				for(let i=0; i < setA.length;i++){
				   let item = setA[i];
				   let val = this.Predicate(item);
				   if(hash.ContainsFromExtractedValue(val) === false){
					   rtn.push(item);
				   }
				}
				return rtn;
            }
        }
        Enumerable.prototype.Disjoint = function(items, pred, pred2) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = function(arr) {
                let p = new DisjointPredicate(items, pred, pred2);
                return p.Execute(arr);
            }
            return new Enumerable(data);
        }
         Enumerable.prototype.Contains = function(item) {
			let scope = this;
            return scope.IndexOf(item) > -1;
        }
        Enumerable.prototype.Except = function(items, pred, pred2) {
			let scope = this;
			pred = pred || function(x){return x;}
			pred2 = pred2 || function(x){return x;}
            let dataToPass = CreateDataForNewEnumerable(scope);
			
			// Uses hashing algorithm
            dataToPass.NewForEachAction = function(arr) {
				if(arr.length == 0){
					return arr;
				}
                let data2 = ParseDataAsArray(items);
				const set = new HashMap(pred);
				const lenA = arr.length;
				const lenB = data2.length;
				
				for (let i = 0; i < lenA; i++) {
					const item = arr[i];
					set.TryAdd(item);
				}
				
				for (let i = 0; i < lenB; i++) {
					const item = data2[i];
					const val = pred2(item);
					if(set.ContainsFromExtractedValue(val)){
						set.Delete(item);
					}
				}
				
				let rtn = set.Flush();
				return rtn;
		
            }
            return new Enumerable(dataToPass);
        }
        Enumerable.prototype.In = function(items, pred, pred2) {
			let scope = this;
			pred = pred || function(x){return x;}
			pred2 = pred2 || function(x){return x;}
            let dataToPass = CreateDataForNewEnumerable(scope);
			
			// Uses hashing algorithm
            dataToPass.NewForEachAction = function(arr) {
				if(arr.length == 0){
					return arr;
				}
                let data2 = ParseDataAsArray(items);
				const set = new HashMap(pred2);
				const lenA = arr.length;
				const lenB = data2.length;
				
				for (let i = 0; i < lenB; i++) {
					const item = data2[i];
					set.TryAdd(item);
				}
				
				const set2 = new HashMap(pred);
				for (let i = 0; i < lenA; i++) {
					const item = arr[i];
					const val = pred(item);
					if(set.ContainsFromExtractedValue(val)){
						set2.TryAdd(item);
					}
				}
				
				set.Clear();
				let rtn = set2.Flush();
				return rtn;
		
            }
            return new Enumerable(dataToPass);
        }
       
		
		Enumerable.prototype.Concat = function(items) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = function(arr) {
                let itemArr = ParseDataAsArray(items);
                let rtn = arr.concat(itemArr);
                return rtn;
            }
            return new Enumerable(data);
        }
        Enumerable.prototype.Prepend = function(items) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = function(arr) {
                let itemArr = ParseDataAsArray(items);
                let rtn = itemArr.concat(arr);
                return rtn;
            }
            return new Enumerable(data);
        }
        Enumerable.prototype.Zip = function(items, pred) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = function(arr) {
                let rtn = [];
                let itemArr = ParseDataAsArray(items);
                for (let i = 0; i < arr.length; i++) {
                    let itemA = arr[i];
                    if (i >= itemArr.length) {
                        return rtn;
                    }
                    let itemB = itemArr[i];
                    let newItem = pred(itemA, itemB);
                    rtn.push(newItem);
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        Enumerable.prototype.ZipUneven = function(items, pred) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = function(arr) {
                let rtn = [];
                let itemArr = ParseDataAsArray(items);
                let maxLen = Math.max(arr.length, itemArr.length);
                for (let i = 0; i < maxLen; i++) {
                    if (i >= arr.length) {
                        rtn.push(itemArr[i]);
                        continue;
                    }
                    if (i >= itemArr.length) {
                        rtn.push(arr[i]);
                        continue;
                    }
                    let itemA = arr[i];
                    let itemB = itemArr[i];
                    let newItem = pred(itemA, itemB);
                    rtn.push(newItem);
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        Enumerable.prototype.Reverse = function() {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = function(arr) {
                let rtn = [];
                for (let i = arr.length - 1; i > -1; i--) {
                    rtn.push(arr[i]);
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        Enumerable.prototype.GroupBy = function(pred) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.GroupingPredicate = pred;
            return new GroupedEnumerable(data);
        }
        Enumerable.prototype.Join = function(data, joinKeysLeft,joinKeysRight, selectPred) {
			let scope = this;
            let dataToPass = CreateDataForNewEnumerable(scope);
			
			// Uses hash join algorithm
            dataToPass.NewForEachAction = function(arr) {
				if(arr.length == 0){
					return arr;
				}
                let data2 = (data.ToArray ? data.ToArray() : data);
				const model = joinKeysLeft(arr[0]);
				const set = new NestedSet(model);
				const lenA = arr.length;
				const lenB = data2.length;
				
				for (let i = 0; i < lenA; i++) {
					const item = arr[i];
					const leftModel = joinKeysLeft(item);
					if(set.has(leftModel) === false){
						set.add(leftModel,[item]);					
					} else {
						let group = set.get(leftModel);				
						group.push(item);		
					}
				}
				
				let rtn = [];
				for (let i = 0; i < lenB; i++) {
					const right = data2[i];
					const rightModel = joinKeysRight(right);
					if(set.has(rightModel) === true){
						let group = set.get(rightModel);
						for(let j = 0; j < group.length; j++){
							let left = group[j];
							if(selectPred !== undefined){
								rtn.push( selectPred(left,right) );
							} else {
								rtn.push( new Joining(left, right) );
							}
						}			
					} 
				}

				return rtn;				
		
            }
            return new Enumerable(dataToPass);
        }
        Enumerable.prototype.LeftJoin = function(data, joinKeysLeft, joinKeysRight, selectPred) {
			let scope = this;
            let dataToPass = CreateDataForNewEnumerable(scope);
			
			// Uses hash join algorithm
            dataToPass.NewForEachAction = function(arr) {
				if(arr.length == 0){
					return arr;
				}
                let data2 = (data.ToArray ? data.ToArray() : data);
				const model = joinKeysLeft(arr[0]);
				const set = new NestedSet(model);
				const lenA = arr.length;
				const lenB = data2.length;
				
				for (let i = 0; i < lenB; i++) {
					const item = data2[i];
					const rightModel = joinKeysRight(item);
					if(set.has(rightModel) === false){
						set.add(rightModel,[item]);					
					} else {
						let group = set.get(rightModel);				
						group.push(item);		
					}
				}
				
				let rtn = [];
				for (let i = 0; i < lenA; i++) {
					const left = arr[i];
					const leftModel = joinKeysLeft(left);
					if(set.has(leftModel) === true){
						let group = set.get(leftModel);
						for(let j = 0; j < group.length; j++){
							let right = group[j];
							if(selectPred !== undefined){
								rtn.push( selectPred(left,right) );
							} else {
								rtn.push( new Joining(left, right) );
							}
						}			
					} else {
						if(selectPred !== undefined){
							rtn.push( selectPred(left, null) );
						} else {
							rtn.push( new Joining(left, null) );
						}						
					}
				}

				return rtn;				
		
            }
            return new Enumerable(dataToPass);
        }
        Enumerable.prototype.RightJoin = function(data, joinKeysLeft, joinKeysRight, selectPred) {
			let scope = this;
            let dataToPass = CreateDataForNewEnumerable(scope);
			
			// Uses hash join algorithm
            dataToPass.NewForEachAction = function(arr) {
				if(arr.length == 0){
					return arr;
				}
                let data2 = ParseDataAsArray(data);
				const model = joinKeysLeft(arr[0]);
				const set = new NestedSet(model);
				const lenA = arr.length;
				const lenB = data2.length;
				
				for (let i = 0; i < lenA; i++) {
					const item = arr[i];
					const leftModel = joinKeysLeft(item);
					if(set.has(leftModel) === false){
						set.add(leftModel,[item]);					
					} else {
						let group = set.get(leftModel);				
						group.push(item);		
					}
				}
				
				let rtn = [];
				for (let i = 0; i < lenB; i++) {
					const right = data2[i];
					const rightModel = joinKeysRight(right);
					if(set.has(rightModel) === true){
						let group = set.get(rightModel);
						for(let j = 0; j < group.length; j++){
							let left = group[j];
							if(selectPred !== undefined){
								rtn.push( selectPred(left,right) );
							} else {
								rtn.push( new Joining(left, right) );
							}
						}			
					} else {
						if(selectPred !== undefined){
							rtn.push( selectPred(null,right) );
						} else {
							rtn.push( new Joining(null, right) );
						}						
					}
				}

				return rtn;				
		
            }
            return new Enumerable(dataToPass);
        }
        Enumerable.prototype.FullJoin = function(data, joinKeysLeft, joinKeysRight, selectPred) {
			let scope = this;
            let dataToPass = CreateDataForNewEnumerable(scope);
			
			// Uses hash join algorithm
            dataToPass.NewForEachAction = function(arr) {
				if(arr.length == 0){
					return arr;
				}
                let data2 = (data.ToArray ? data.ToArray() : data);
				const model = joinKeysLeft(arr[0]);
				let set = new NestedSet(model);
				const lenA = arr.length;
				const lenB = data2.length;
				let rtn = [];
				
				// Fill the set with items from the right side
				for (let i = 0; i < lenB; i++) {
					const item = data2[i];
					const rightModel = joinKeysRight(item);
					if(set.has(rightModel) === false){
						set.add(rightModel,[item]);					
					} else {
						let group = set.get(rightModel);				
						group.push(item);		
					}
				}
				
				// Do a left join first
				for (let i = 0; i < lenA; i++) {
					const left = arr[i];
					const leftModel = joinKeysLeft(left);
					if(set.has(leftModel) === true){
						let group = set.get(leftModel);
						for(let j = 0; j < group.length; j++){
							let right = group[j];
							if(selectPred !== undefined){
								rtn.push( selectPred(left,right) );
							} else {
								rtn.push( new Joining(left, right) );
							}
						}			
					} else {
						if(selectPred !== undefined){
							rtn.push( selectPred(left, null) );
						} else {
							rtn.push( new Joining(left, null) );
						}						
					}
				}
				
				set.clear();
				
				// Fill the set with items from the left side
				for (let i = 0; i < lenA; i++) {
					const item = arr[i];
					const leftModel = joinKeysLeft(item);
					if(set.has(leftModel) === false){
						set.add(leftModel,[item]);					
					} else {
						let group = set.get(leftModel);				
						group.push(item);		
					}
				}
				
				// Get the remaining items missing from the right join
				for (let i = 0; i < lenB; i++) {
					const right = data2[i];
					const rightModel = joinKeysRight(right);
					if(set.has(rightModel) === false){
						if(selectPred !== undefined){
							rtn.push( selectPred(null, right) );
						} else {
							rtn.push( new Joining(null, right) );
						}			
					} 
				}
				return rtn;				
            }
            return new Enumerable(dataToPass);
        }
        Enumerable.prototype.Count = function(pred) {
			let scope = this;
			if(pred !== undefined){
				return scope.Where(x=>pred(x)).ToArray().length;
			}
            return scope.ToArray().length;
        }
        Enumerable.prototype.Average = function(pred) {
			let scope = this;
            let arr = scope.ToArray();
            let sum = 0;
            for (let i = 0; i < arr.length; i++) {
                let item = arr[i];
                if (pred) {
                    sum += pred(item);
                } else {
                    sum += item;
                }
            }
            return sum / arr.length;
        }
        Enumerable.prototype.Variance = function(pred) {
			let scope = this.ToEnumerable();
            let avg = scope.Average(pred);
			let cnt = scope.Count();
			if(pred !== undefined){
				return scope.Select(function(x){
					let val = pred(x) - avg;
					return (val*val);
				}).Sum() / cnt;
			}
			return scope.Select(function(x){
				let val = x - avg;
				return (val*val);
			}).Sum() / cnt;
        }
		Enumerable.prototype.StdDev = function(pred){
			let scope = this;
			let v = scope.Variance(pred);
			return Math.sqrt(v);
		}
        Enumerable.prototype.Median = function(pred) {
			let scope = this;
            let values = [];
            if (pred) {
                values = scope.Select(pred).ToArray();
            } else {
                values = scope.ToArray();
            }
            values.sort(function(a, b) {
                return a - b;
            });
            let half = Math.floor(values.length / 2);
            if (values.length % 2) {
                return values[half];
            } else {
                return (values[half - 1] + values[half]) / 2.0;
            }
        }
        Enumerable.prototype.Mode = function(pred, level) {
			let scope = this;
            let groups = [];
            level = level || 0;
            if (pred) {
                groups = scope.GroupBy(v => ({Value:pred(v)}));
            } else {
                groups = scope.GroupBy(v => ({Value:v}));
            }
            return groups.MaxBy(g => g.Items.Count(), level);
        }
        Enumerable.prototype.Sum = function(pred) {
			let scope = this;
            let arr = scope.ToArray();
            let sum = 0;
            for (let i = 0; i < arr.length; i++) {
                let item = arr[i];
                if (pred) {
                    sum += pred(item);
                } else {
                    sum += item;
                }
            }
            return sum;
        }
        let MaxPredicate = function(pred, level) {
			Reconstructable.apply(this,arguments);
            this.Level = level || 0;
            this.Predicate = pred;
            this.MaxFirst = function(SCOPE) {
                let max = Number.NEGATIVE_INFINITY;
                let arr = SCOPE.ToArray();
                let pred = this.Predicate;
                for (let i = 0; i < arr.length; i++) {
                    let item = arr[i];
                    if (this.Predicate) {
                        item = this.Predicate(item);
                    }
                    if (item > max) {
                        max = item;
                    }
                }
                return max;
            }
            this.Max_N = function(SCOPE) {
                let arr = SCOPE.ToArray();
                let level = this.Level;
                if (this.Predicate) {
                    let pred = this.Predicate;
                    arr.sort(function(a, b) {
                        let aa = pred(a);
                        let bb = pred(b);
                        if (aa < bb) {
                            return 1;
                        }
                        if (aa > bb) {
                            return -1;
                        }
                        return 0;
                    });
                } else {
                    arr.sort(Enumerable.Functions.SortDesc);
                }
                let max = arr[0];
                if (this.Predicate) {
                    max = this.Predicate(max);
                }
                let lastMax = max;
                for (let i = 1; i < arr.length; i++) {
                    let item = arr[i];
                    if (this.Predicate) {
                        item = this.Predicate(item);
                    }
                    if (item == lastMax) {
                        continue;
                    }
                    if (item < lastMax) {
                        lastMax = item;
                        level--;
                        if (level <= 1) {
                            return lastMax;
                        }
                    }
                }
                return lastMax;
            }
            this.Max = function(SCOPE) {
                if (this.Level <= 1) {
                    return this.MaxFirst(SCOPE);
                }
                return this.Max_N(SCOPE);
            }
            this.MaxByFirst = function(SCOPE) {
                let max = this.Max(SCOPE);
                let pred = this.Predicate;
                if (this.Predicate) {
                    return SCOPE.Where(x => pred(x) == max);
                }
                return SCOPE.Where(x => x == max);
            }
            this.MaxBy_N = function(SCOPE) {
                let max = this.Max_N(SCOPE);
                let pred = this.Predicate;
                if (this.Predicate) {
                    return SCOPE.Where(x => pred(x) == max);
                }
                return SCOPE.Where(x => x == max);
            }
            this.MaxBy = function(SCOPE) {
                if (this.Level <= 1) {
                    return this.MaxByFirst(SCOPE);
                }
                return this.MaxBy_N(SCOPE);
            }
        }
        Enumerable.prototype.Max = function(pred, level) {
			let scope = this;
            let maxPred = new MaxPredicate(pred, level);
            return maxPred.Max(scope);
        }
        Enumerable.prototype.MaxBy = function(pred, level) {
			let scope = this;
            let maxPred = new MaxPredicate(pred, level);
            return maxPred.MaxBy(scope);
        }
        let MinPredicate = function(pred, level) {
			Reconstructable.apply(this,arguments);
            this.Level = level || 0;
            this.Predicate = pred;
            this.MinFirst = function(SCOPE) {
                let min = Number.POSITIVE_INFINITY;
                let arr = SCOPE.ToArray();
                let pred = this.Predicate;
                for (let i = 0; i < arr.length; i++) {
                    let item = arr[i];
                    if (this.Predicate) {
                        item = this.Predicate(item);
                    }
                    if (item < min) {
                        min = item;
                    }
                }
                return min;
            }
            this.Min_N = function(SCOPE) {
                let arr = SCOPE.ToArray();
                let level = this.Level;
                if (this.Predicate) {
                    let pred = this.Predicate;
                    arr.sort(function(a, b) {
                        let aa = pred(a);
                        let bb = pred(b);
                        if (aa < bb) {
                            return -1;
                        }
                        if (aa > bb) {
                            return 1;
                        }
                        return 0;
                    });
                } else {
                    arr.sort(Enumerable.Functions.SortAsc);
                }
                if (this.Predicate) {
                    min = this.Predicate(min);
                }
                let lastMin = min;
                for (let i = 1; i < arr.length; i++) {
                    let item = arr[i];
                    if (this.Predicate) {
                        item = this.Predicate(item);
                    }
                    if (item == lastMin) {
                        continue;
                    }
                    if (item > lastMin) {
                        lastMin = item;
                        level--;
                        if (level <= 1) {
                            return lastMin;
                        }
                    }
                }
                return lastMin;
            }
            this.Min = function(SCOPE) {
                if (this.Level <= 1) {
                    return this.MinFirst(SCOPE);
                }
                return this.Min_N(SCOPE);
            }
            this.MinByFirst = function(SCOPE) {
                let min = this.Min(SCOPE);
                let pred = this.Predicate;
                if (this.Predicate) {
                    return SCOPE.Where(x => pred(x) == min);
                }
                return SCOPE.Where(x => x == min);
            }
            this.MinBy_N = function(SCOPE) {
                let min = this.Min_N(SCOPE);
                let pred = this.Predicate;
                if (this.Predicate) {
                    return SCOPE.Where(x => pred(x) == min);
                }
                return SCOPE.Where(x => x == min);
            }
            this.MinBy = function(SCOPE) {
                if (this.Level <= 1) {
                    return this.MinByFirst(SCOPE);
                }
                return this.MinBy_N(SCOPE);
            }
        }
        Enumerable.prototype.Min = function(pred, level) {
			let scope = this;
            let minPred = new MinPredicate(pred, level);
            return minPred.Min(scope);
        }
        Enumerable.prototype.MinBy = function(pred, level) {
			let scope = this;
            let minPred = new MinPredicate(pred, level);
            return minPred.MinBy(scope);
        }
        Enumerable.prototype.Range = function(pred, level) {
			let scope = this;
            let minPred = new MinPredicate(pred, level);
			let maxPred = new MaxPredicate(pred,level);
            return new Range(minPred.Min(scope), maxPred.Max(scope));
        }
        Enumerable.prototype.RangeBy = function(pred, level) {
			let scope = this;
            let minPred = new MinPredicate(pred, level);
			let maxPred = new MaxPredicate(pred,level);
            return new Range(minPred.MinBy(scope), maxPred.MaxBy(scope));
        }
        Enumerable.prototype.Aggregate = function(pred, seed) {
			let scope = this;
            let curr = seed || null;
            let arr = scope.ToArray();
            for (let i = 0; i < arr.length; i++) {
                let item = arr[i];
                if (curr == null) {
                    curr = item;
                    continue;
                }
                let val = item;
                curr = pred(curr, val);
            }
            return curr;
        }
        Enumerable.prototype.OfType = function(type) {
			let scope = this;
            return scope.Where(x => (typeof x) == type);
        }
        Enumerable.prototype.OfInstance = function(type) {
			let scope = this;
            return scope.Where(x => x instanceof type);
        }
        Enumerable.prototype.Insert = function(idx, data) {
			let scope = this;
            return scope.InsertRange(idx, [data]);
        }
        Enumerable.prototype.InsertRange = function(idx, data) {
			let scope = this;
            let dataToPass = CreateDataForNewEnumerable(scope);
			
            dataToPass.NewForEachAction = function(arr) {
                let rtn = [];
                for (let i = 0; i < arr.length; i++) {
                    if (i == idx) {
                        for (let j = 0; j < data.length; j++) {
                            rtn.push(data[j]);
                        }
                    }
                    rtn.push(arr[i]);
                }
                return rtn;
            }
            return new Enumerable(dataToPass);
        }
        Enumerable.prototype.Choice = function(cnt) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = function(arr) {
                let rtn = [];
                for (let i = 0; i < cnt; i++) {
                    let idx = Math.floor(arr.length * Math.random());
                    rtn.push(arr[idx]);
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        Enumerable.prototype.Cycle = function(cnt) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = function(arr) {
                let rtn = [];
                for (let i = 0; i < cnt; i++) {
                    let idx = i % arr.length;
                    rtn.push(arr[idx]);
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        Enumerable.prototype.Repeat = function(elm, cnt) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = function(arr) {
                let rtn = arr.slice();
                for (let i = 0; i < cnt; i++) {
                    rtn.push(elm);
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        Enumerable.prototype.ElementAt = function(idx) {
			let scope = this;
            let arr = scope.ToArray();
            return arr[idx];
        }
        Enumerable.prototype.Push = function(elm) {
			let scope = this;
            return scope.Concat([elm]);
        }
        Enumerable.prototype.Pop = function() {
			let scope = this;
            return scope.TakeExceptLast(1);
        }
        Enumerable.prototype.Shuffle = function() {
			let scope = this;
            return scope.OrderBy(Enumerable.Functions.ShuffleSort);
        }
        Enumerable.prototype.Scan = function(seed,generator) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = function(arr) {
				if(arr.length === 0){
					return arr;
				}
                let rtn = [];
				let prev = seed || arr[0];
				let curr = prev;
				let startIdx = 0;
				if(prev === null){
					startIdx = 1;
				}
                for (let i = startIdx; i < arr.length; i++) {
					let item = arr[i];
					let oldCurr = curr;
					curr = generator(prev,curr,i);
					prev = oldCurr;
                    rtn.push(curr);
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        let CatchPredicate = function(handler, refPred) {
 			Reconstructable.apply(this,arguments);
           this.Handler = handler;
            this.HandledPredicate = refPred;
            this.Predicate = function(item) {
                try {
                    return this.HandledPredicate.Execute(item);
                } catch (e) {
                    this.Handler(e, item);
                    return InvalidItem;
                }
            }
            this.Reset = function() {};
            this.Execute = function(item) {
                return this.Predicate(item);
            }
        }
        Enumerable.prototype.Catch = function(handler) {
			let scope = this;
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates.slice(),
                ForEachActionStack: scope.ForEachActionStack
            };
            let oldPredicate = data.Predicates.pop();
            data.NewPredicate = new CatchPredicate(handler, oldPredicate);
            return new Enumerable(data);
        }
        let TracePredicate = function(msg) {
 			Reconstructable.apply(this,arguments);
           this.Message = msg;
            this.Predicate = function(item) {
                console.log(this.Message, ":", item);
                return item;
            }
            this.Execute = function(item) {
                return this.Predicate(item);
            }
            this.Reset = function() {}
        }
        Enumerable.prototype.Trace = function(msg) {
			let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            let oldPredicate = data.Predicate;
            data.NewPredicate = new TracePredicate(msg);
            return new Enumerable(data);
        }
        Enumerable.prototype.Write = function(symbol, pred) {
			let scope = this;
            if (!pred) {
                return scope.Aggregate(function(curr, next) {
                    return curr + symbol + next;
                });
            }
            return scope.Select(pred).Aggregate(function(curr, next) {
                return curr + symbol + next;
            });
        }
        Enumerable.prototype.WriteLine = function(pred) {
			let scope = this;
            return scope.Write("\r\n", pred);
        }
        Enumerable.prototype.Clone = function() {
			let scope = this;
            let privData = CreateDataForNewEnumerable(scope);
            return new Enumerable(privData)
        }
        Enumerable.prototype.SequenceEqual = function(other,comparer) {
			let scope = this;
            var a1 = scope.ToArray();
			var a2 = ParseDataAsArray(other);
			if(a1.length !== a2.length){
				return false;
			}
			for(let i = 0; i < a1.length; i++){
				let itemA = a1[i];
				let itemB = a2[i];
				if(comparer !== undefined){
					if(comparer(itemA,itemB) === false){
						return false;
					}
				} else {
					if(itemA !== itemB){
						return false;
					}
				}
			}
			return true;
        }
        Enumerable.prototype.SequenceEqualUnordered = function(other,keyLeft,keyRight) {
			let scope = this;
            var a1 = scope.ToArray();
			var a2 = ParseDataAsArray(other);
			if(a1.length === 0 && a2.length === 0){
				return true;
			}
			if(a1.length === 0 && a2.length !== 0 || a1.length !== 0 && a2.length === 0){
				return false;
			}
			
			const model = keyLeft(a1[0]);
			const set = new NestedSet(model);
			const lenA = a1.length;
			const lenB = a2.length;
			
			for (let i = 0; i < lenA; i++) {
				const item = a1[i];
				const leftModel = keyLeft(item);
				if(set.has(leftModel) === false){
					set.add(leftModel,[item]);					
				} 
			}
			for(let i = 0; i < lenB; i++){
				const item = a2[i];
				const rightModel = keyRight(item);
				if(set.has(rightModel) === false){
					return false;		
				} 				
			}
			return true;
		}
		Enumerable.prototype.Sequence = function(cnt,seed,generator) {
			let scope = this;
			let data = {
				Data: scope.Data,
				Predicates: scope.Predicates,
				ForEachActionStack: scope.ForEachActionStack
			};
			data.NewForEachAction = function(arr) {
				let rtn = arr;
				let newEnum = PublicEnumerable.Sequence(cnt,seed,generator).ToArray();
				return rtn.concat(newEnum);
			}
			return new Enumerable(data);
		}
		
    let OrderPredicate = function(pred, desc) {
        this.SortFunctions = [];
        let scope = this;
        this.SortComparer = null;
        this.Composite = function(newPred, newDesc) {
            if (this.SortComparer === null) {
                if (desc) {
                    this.SortComparer = function(a, b) {
                        let val1 = newPred(a);
                        let val2 = newPred(b);
                        if (val1 < val2) {
                            return 1;
                        }
                        if (val1 > val2) {
                            return -1;
                        }
                        return 0;
                    };
                } else {
                    this.SortComparer = function(a, b) {
                        let val1 = newPred(a);
                        let val2 = newPred(b);
                        if (val1 < val2) {
                            return -1;
                        }
                        if (val1 > val2) {
                            return 1;
                        }
                        return 0;
                    };
                }
                return;
            }
            let oldSort = this.SortComparer;
            if (newDesc) {
                this.SortComparer = function(a, b) {
                    let oldRes = oldSort(a, b);
                    if (oldRes !== 0) {
                        return oldRes;
                    }
                    let val1 = newPred(a);
                    let val2 = newPred(b);
                    if (val1 < val2) {
                        return 1;
                    }
                    if (val1 > val2) {
                        return -1;
                    }
                    return 0;
                };
            } else {
                this.SortComparer = function(a, b) {
                    let oldRes = oldSort(a, b);
                    if (oldRes !== 0) {
                        return oldRes;
                    }
                    let val1 = newPred(a);
                    let val2 = newPred(b);
                    if (val1 < val2) {
                        return -1;
                    }
                    if (val1 > val2) {
                        return 1;
                    }
                    return 0;
                };
            }
        };
        this.Execute = function(array) {
            return array.sort(scope.SortComparer);
        };
        this.Composite(pred, desc);
    };

    function OrderedEnumerable(privateData) {
        let scope = this;
        let argsToApply = [{
            Data: privateData.Data,
            ForEachActionStack: privateData.ForEachActionStack,
            Predicates: privateData.Predicates,
            Scope: scope
        }];
        Enumerable.apply(this, argsToApply);
        // Private variables for module
        let Descending = privateData.Descending;
        let SortComparer = privateData.SortComparer;
        let SortingPredicate = new OrderPredicate(SortComparer, Descending);
        this.AddToForEachStack(function(arr) {
            SortingPredicate.Execute(arr);
            return arr;
        });
        this.ThenByDescending = function(pred) {
            SortingPredicate.Composite(pred, true);
            return this;
        };
        this.ThenBy = function(pred) {
            SortingPredicate.Composite(pred, false);
            return this;
        };
    }
	
	OrderedEnumerable.prototype = Enumerable.prototype;

    function GroupedEnumerable(privateData) {
        let scope = this;
        const argsToApply = [{
            Data: privateData.Data,
            ForEachActionStack: privateData.ForEachActionStack,
            Predicates: privateData.Predicates,
            Scope: scope
        }];
        Enumerable.apply(this, argsToApply);
        // Private variables for module
        let GroupingPredicates = privateData.GroupingPredicate;

		let HavingFunc = function(arr){return arr;}
		
        let GroupingFunc = function(arr) {
            if (arr.length === 0) {
                return arr;
            }
            const groups = [];
            const groupsIdx = new Map();
            const model = GroupingPredicates(arr[0]);
            const set = new NestedSet(model);
			const len = arr.length;
			
            for (let i = 0; i < len; i++) {
                const item = arr[i];
                const groupModel = GroupingPredicates(item);
				if(set.has(groupModel) === false){
					let group = new GroupInternal(groupModel);
					set.add(groupModel,group);			
					groups.push(group);
					groupsIdx.set(group,groups.length-1);		
					group.Items.push(item);				
				} else {
					let group = set.get(groupModel);				
					group.Items.push(item);				
				}
            }
			for(let i = 0; i < groups.length; i++){
				let group = groups[i];
				groups[i] = new Group(group.Key,group.Items);
			}
			set.clear();
            return HavingFunc(groups);
        }
        this.AddToForEachStack(function(arr) {
            return GroupingFunc(arr);
        });
		this.Having = function(pred){
			let oldHaving = HavingFunc;
			HavingFunc = function(arr){
				arr = oldHaving(arr);
				let newArr = [];
				for(let i = 0; i < arr.length; i++){
					let group = arr[i];
					let items = group.Items;
					if(pred(items) === true){ 
						newArr.push(group);
					}
				}
				return newArr;
			}
			return this;
		}
    };
	
	GroupedEnumerable.prototype = Enumerable.prototype;

    function FilteredEnumerable(privateData) {
        let scope = this;
        let argsToApply = [{
            Data: privateData.Data,
            ForEachActionStack: privateData.ForEachActionStack,
            Predicates: privateData.Predicates,
            Scope: scope
        }];
        Enumerable.apply(this, argsToApply);
        // Private variables for module
        let WherePredicate = privateData.WherePredicate;

        this.AddToPredicateStack(WherePredicate);

    }
   
	FilteredEnumerable.prototype = Enumerable.prototype;

	function Dictionary(){
		this._map = new Map();
		Enumerable.apply(this,[ [] ]);
	}
	Dictionary.prototype = Object.create(Enumerable.prototype);
	Object.defineProperty(Dictionary.prototype,"Data",{
		get: function getData(){
			return this.ToArray();
		},
		set: function setData(){
			
		}
	});
	Dictionary.prototype.GetKeys = function() {
		let rtn = Array.from(this._map.keys());
		return ParseDataAsEnumerable(rtn);
	}
	Dictionary.prototype.GetValues = function() {
		let rtn = Array.from(this._map.values());
		return ParseDataAsEnumerable(rtn);
	}
	Dictionary.prototype.ForEach = function(action){
		let scope = this;
		let keys = scope.GetKeys().ToArray();
		for(let i = 0; i < keys.length; i++){
			let key = keys[i];
			let val = scope._map.get(key);
			let kvp = new KeyValuePair(key,val);
			let result = action(i,kvp);
			if(result === false){
				break;
			}
		}
	}
	Dictionary.prototype.ContainsKey = function(key){
		return this._map.has(key);
	}
	Dictionary.prototype.ContainsValue = function(val){
		let scope = this;
		let result = false;
		scope.ForEach( function(i,kvp){
			if(kvp.Value === val){
				result = true;
				return false;
			}
		});
		return result;
	}
	Dictionary.prototype.Get = function(key){
		let scope = this;
		if(scope._map.has(key) === false){
			throw new Error("Dictionary does not contain the given key: " + key);
		}
		return scope._map.get(key);
	}
	Dictionary.prototype.Set = function(key,value){
		let scope = this;
		scope._map.set(key,value);
	}
	Dictionary.prototype.Add = function(key,value){
		let scope = this;
		if(scope._map.has(key)){
			throw new Error("Dictionary already contains the given key: " + key);
		}
		scope._map.set(key,value);
	}
	Dictionary.prototype.Clear = function(){
		this._map.clear();
	}
	Dictionary.prototype.Remove = function(key){
	    this._map.delete(key);
	}
	Dictionary.prototype.ToArray = function(){
		let arr = [];
		this.ForEach( (i, kvp) => {
			arr.push(kvp);
		});
		return arr;		
	}
	Dictionary.prototype.ToEnumerable = function(){
		let arr = this.ToArray();
		return ParseDataAsEnumerable(arr);
	}
	Dictionary.prototype.GetEnumerator = function(){
		return new MapEnumerator(this._map);
	}
	Dictionary.prototype[Symbol.iterator] = function () {
			let enumerator = this.GetEnumerator();
			return {
				next: () => {
					enumerator.Next();
					return { value: enumerator.Current, done: enumerator.Done };
				}
			};
	}
	
	function Lookup(){
		Dictionary.apply(this,[]);
		let scope = this;
	}
	Lookup.prototype = Object.create(Dictionary.prototype);
	Lookup.prototype.ContainsValue = function(val){
		let scope = this;
		let result = false;
		scope.ForEach( function(kvp){
			if(kvp.Value.Contains(val) > -1){
				result = true;
				return false;
			}
		});
		return result;
	}
	Lookup.prototype.Add = function(key,value){
		let scope = this;
		if(scope._map.has(key) === false){
			scope._map.set(key,ParseDataAsEnumerable([]));
		}
		scope._map.get(key).Data.push(value);
	}	
	Lookup.prototype.Set = function(key,value){
		let scope = this;
		let val = ParseDataAsEnumerable(value);
		scope._map.set(key,val);
	}	
	
	
    PublicEnumerable.prototype.Extend = function(extenderMethod) {
            extenderMethod(Enumerable.prototype);
        }
        // The preferred smart constructor
    PublicEnumerable.From = function(data) {
            let d = ParseDataAsArray(data);
            return new PublicEnumerable(d);
        }
        // Public Static Methods
    PublicEnumerable.Range = function(start, count, step) {
        let arr = [];
        step = step || 1;
        let curr = start;
        for (let i = 0; i < count; i++) {
            arr.push(curr);
            curr = curr + step;
        }
        return PublicEnumerable.From(arr);
    }
    PublicEnumerable.RangeTo = function(start, to, step) {
        let arr = [];
        step = step || 1;
        let sign = 1;
        if (to < start) {
            sign = -1;
            start *= -1;
            to *= -1;
        }
        for (let i = start; i <= to; i += step) {
            arr.push(i * sign);
        }
        return PublicEnumerable.From(arr);
    }
    PublicEnumerable.RangeDown = function(start, count, step) {
        return PublicEnumerable.Range(start, count, -step);
    }
    PublicEnumerable.Empty = function() {
            return PublicEnumerable.From([]);
        }
	PublicEnumerable.Sequence = function(cnt,seed,generator) {
		let arr = [];
		seed = seed || [];
		arr = seed.splice();
		for (let i = 0; i < cnt; i++) {
			let newVal = generator(arr,i);
			arr.push(newVal);
		}
		return ParseDataAsEnumerable(arr);
	}
        // Internal Utilities
    Enumerable.Functions = {};
    Enumerable.Functions.SortAsc = function(a, b) {
        if (a < b) {
            return -1;
        }
        if (a > b) {
            return 1;
        }
        return 0;
    }
    Enumerable.Functions.SortDesc = function(a, b) {
        if (a < b) {
            return 1;
        }
        if (a > b) {
            return -1;
        }
        return 0;
    }
    Enumerable.Functions.ShuffleSort = function(a, b) {
        return -0.5 + Math.random();
    }
    Enumerable.CreateSortFunction = function(pred, desc) {
        if (desc) {
            return function(a, b) {
                let aa = pred(a);
                let bb = pred(b);
                return Enumerable.Functions.SortDesc(aa, bb);
            }
        }
        return function(a, b) {
            let aa = pred(a);
            let bb = pred(b);
            return Enumerable.Functions.SortAsc(aa, bb);
        }
    }
    Enumerable.CreateCompositeSortFunction = function(oldComparer, pred, desc) {
            let newSort = Enumerable.CreateSortFunction(pred, desc);
            return function(a, b) {
                let initialResult = oldComparer(a, b);
                if (initialResult !== 0) {
                    return initialResult;
                }
                return newSort(a, b);
            }
        }
        // Create a short-hand, plus NoConflict
    let _Old = window._;
    window._ = PublicEnumerable;
    PublicEnumerable.NoConflict = function() {
        if (window._ !== PublicEnumerable) {
            return PublicEnumerable;
        }
        if (_Old !== undefined) {
            window._ = _Old;
        } else {
            delete window._;
        }
        return PublicEnumerable;
    }
    return PublicEnumerable;
}());
