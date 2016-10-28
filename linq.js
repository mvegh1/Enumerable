'use strict';
let Enumerable = (function() {
    // Private constant variables for module
    let InvalidItem;

    // Private Classes for module
    function Reconstructable() {
        let Arguments = Array.from(arguments);
        this.Reconstruct = function() {
            return Reflect.construct(this.constructor, Arguments);
        }
    }

    function GroupInternal(key) {
        this.Key = key;
        this.Items = [];
    }

    function Group(key, data) {
        this.Key = key;
        this.Items = ParseDataAsEnumerable(data);
    }

    function Range(min, max) {
        this.Min = min;
        this.Max = max;
    }

    function KeyValuePair(key, value) {
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
            let val = this.ExtractValue(obj);
            if (this.Hash.has(val)) {
                return undefined;
            }
            this.Hash.set(val, obj);
            return val;
        }
        this.Delete = function(obj) {
            let val = this.ExtractValue(obj);
            this.Hash.delete(val);
        }
        this.GetHashKeyOrInsertNew = function(obj) {
            let val = this.ExtractValue(obj);
            if (this.Hash.has(val)) {
                return val;
            }
            this.Hash.set(val, obj);
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

    function NestedSet(model) {
        this.Model = model;
        this.Keys = Object.keys(this.Model);
        const len = this.Keys.length;
        const breakPt = len - 1;
        this.Map = new Map();
        this.has = function(obj) {
            return this.get(obj) !== undefined;
        }
        this.get = function(obj) {
            let map = this.Map;
            for (let i = 0; i < len; i++) {
                let key = this.Keys[i];
                let val = obj[key];
                if (map.has(val)) {
                    if (i === breakPt) {
                        return map.get(val);
                    }
                    map = map.get(val);
                } else {
                    return undefined;
                }
            }
            return undefined;
        }
        this.add = function(obj, saveVal) {
            let map = this.Map;
            for (let i = 0; i < len; i++) {
                let key = this.Keys[i];
                let val = obj[key];
                if (map.has(val) === false) {
                    if (i === breakPt) {
                        map.set(val, saveVal);
                        return;
                    } else {
                        map.set(val, new Map());
                        map = map.get(val);
                    }
                } else {
                    if (i === breakPt) {
                        return;
                    } else {
                        map = map.get(val);
                    }
                }
            }
        }
        this.clear = function() {
            this.Map.clear();
        }
    }

    function EnumeratorItem(val, done) {
        this.Value = val;
        this.Done = done;
    }

    function Enumerator(data) {
        this.Data = data;
        this.Index = -1;
        this.Current = undefined;
        this.Done = false;
    }
    Enumerator.prototype.Next = function() {
        if (this.Index >= this.Data.length) {
            this.Done = true;
            this.Current = undefined;
            return new EnumeratorItem(undefined, true);
        }
        this.Index++;
        let done = this.Index >= this.Data.length;
        this.Done = done;
        this.Current = this.Data[this.Index];
        return new EnumeratorItem(this.Current, done);
    }

	function EnumeratorCollection(){
		this.Collection = [];
		this.Current = undefined;
		this.Done = false;
		this.Index = -1;
	}
	EnumeratorCollection.prototype.AddItem = function(item){
		this.Collection.push( new Enumerator( [item] ) );
	}
	EnumeratorCollection.prototype.AddItems = function(items){
		let enumerable = ParseDataAsEnumerable(items);
		let enumerator = enumerable.GetEnumerator();
		this.Collection.push( enumerator );
	}
	EnumeratorCollection.prototype.Next = function(){
		if(this.Collection.length === 0 || this.Index > this.Collection.length - 1){
			this.Current = undefined;
			this.Done = true;
			return new EnumeratorItem(undefined,true);
		}
		let enumerator = this.Collection[this.Index];
		if(enumerator === undefined){
			this.Index++;
			enumerator = this.Collection[this.Index];
			if(enumerator === undefined){
				this.Current = undefined;
				this.Done = true;
				return new EnumeratorItem(undefined,true);
			}
		}
		var next = enumerator.Next();
		if(next.Value === undefined){
			this.Index++;
			return this.Next();
		}
		this.Current = next.Value;
		this.Done = next.Done;
		return next;
	}
    
	function LazyEnumerator(data) {
        this.Data = data.Data;
        this.Enumerable = data.Clone();
        this.Index = -1;
        this.Current = undefined;
        this.Done = false;
    }
    LazyEnumerator.prototype.Next = function() {
        if (this.Index === -1) {
            this.Data = this.Enumerable.ForEachActionStack[this.Enumerable.ForEachActionStack.length - 1](this.Data);
        }
        if (this.Index >= this.Data.length) {
            ResetPredicates(this.Enumerable.Predicates);
            return new EnumeratorItem(undefined, true);
        }
        let item = InvalidItem;
        while (item === InvalidItem) {
            this.Index++;
            if (this.Index >= this.Data.length) {
                this.Current = undefined;
                this.Done = true;
                ResetPredicates(this.Enumerable.Predicates);
                return new EnumeratorItem(undefined, true);
            }
            item = this.Data[this.Index];
            for (let j = 0, len2 = this.Enumerable.Predicates.length; j != len2; j++) {
                let Predicate = this.Enumerable.Predicates[j];
                item = Predicate.Execute(item, this.Index, this.Data.length);
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
            return new EnumeratorItem(item, done);
        }
    }

    function IteratorEnumerator(iterator) {
        this.Iterator = iterator;
        this.Index = -1;
        this.Current = undefined;
        this.Done = false;
    }
    IteratorEnumerator.prototype.Next = function() {
        if (this.Done === true) {
            return new EnumeratorItem(this.Current, this.Done);
        }
        let next = this.Iterator.next();
        this.Done = next.done;
        this.Current = next.value;
        return new EnumeratorItem(this.Current, this.Done);
    }

    function MapEnumerator(source) {
        this.Data = source;
        this.Index = -1;
        this.Current = undefined;
        this.Done = false;
        this.KeyIterator;
    }
    MapEnumerator.prototype.Next = function() {
        if (this.Index === -1) {
            this.KeyIterator = new IteratorEnumerator(this.Data.keys());
        }
        if (this.Done === true) {
            return new EnumeratorItem(this.Current, this.Done);
        }
        this.Index++;
        let next = this.KeyIterator.Next();
        if (next.Value === undefined) {
            this.Current = undefined;
            this.Done = true;
            return new EnumeratorItem(this.Current, this.Done);
        }

        this.Done = next.Done;
        let val = this.Data.get(next.Value);
        this.Current = new KeyValuePair(next.Value, val);
        return new EnumeratorItem(this.Current, this.Done);
    }
    
	function MemoizeFunc(func){
		this.Func = func;
		this.Cache = new Map();
	}
	MemoizeFunc.prototype.Call = function(){
		let args = Array.from(arguments);
		let currentLevel = this.Cache;
		
		// Iterate thru arguments
		for(let i = 0; i < args.length; i++){
			let arg = args[i];
			// Already cached this, fetch and continue
			if(currentLevel.has(arg)){
				currentLevel = currentLevel.get(arg);
			} else {
				// Not cached, and last level. Calculate the final value to cache
				if(i >= args.length - 1){
					let val = this.Func.apply(this,args);
					currentLevel.set(arg,val);
					return val;
				} else {
					// Not cached, but not at last level. Set this to a new Mapping
					currentLevel.set(arg, new Map());
					currentLevel = currentLevel.get(arg);
				}
			}
		}
		return currentLevel
	}
	function MemoizeFuncAsync(func, callBack){
		let scope = this;
		this.Func = func;
		this.Cache = new Map();	
		this.Callback = callBack;
		this.Events = new EventManager();
		this.Events.BindEvent("OnResolve", (data, args)=>{
			scope.SetCache(args,data);
			callBack(data);
		});
		this.Events.BindEvent("OnReject", (data, args)=>{
			callBack(data, args);
		});
	}
	MemoizeFuncAsync.prototype.SetCache = function(args, value){
		let currentLevel = this.Cache;
		for(let i = 0; i < args.length; i++){
			let arg = args[i];
			// Already cached this
			if(currentLevel.has(arg)){
				// Overwrite the value in the cache
				if(i >= args.length -1){
					currentLevel.set(arg,value);
					return value;
				}
				// Get the next level
				currentLevel = currentLevel.get(arg);
			} else {
				// Not cached, and last level. Set the final value to cache
				if(i >= args.length - 1){
					currentLevel.set(arg,value);
					return value;
				}
				// Not cached, but not at last level. Set this to a new Mapping
				currentLevel.set(arg, new Map());
				currentLevel = currentLevel.get(arg);
			}
		}	
		return value;
	}
	MemoizeFuncAsync.prototype.Call = function(){
		let args = Array.from(arguments);
		let currentLevel = this.Cache;
		let token = new AsyncToken(this);
		let arg = null;
		token.Events.BindEvent("OnResolve", (data) => {
			this.Events.FireEvent("OnResolve", [data,args]);
		});
		token.Events.BindEvent("OnReject", (data) => {
			this.Events.FireEvent("OnReject", [data, args]);
		});
		// Iterate thru arguments
		for(let i = 0; i < args.length; i++){
			arg = args[i];
			// Already cached this, fetch and continue
			if(currentLevel.has(arg)){
				currentLevel = currentLevel.get(arg);
			} else {
				// Not cached, and last level. Calculate the final value to cache
				if(i >= args.length - 1){
					console.log("Fetching fresh async data")
					let newArgs = args.slice();
					newArgs.push(token);
					this.Func.apply(this,newArgs);
					return;
				} else {
					// Not cached, but not at last level. Set this to a new Mapping
					currentLevel.set(arg, new Map());
					currentLevel = currentLevel.get(arg);
				}
			}
		}
		console.log("Sending back cached data");
		this.Events.FireEvent("OnResolve",[currentLevel,args]);
	}
	
	function AsyncToken(owner){
		this.Owner = owner;
		this.Reason = new BaseReason();
		this.Events = new EventManager();
	}
	AsyncToken.prototype.Reject = function(data){
		this.Reason = new RejectReason(data);
		this.Events.FireEvent("OnReject",[data]);
	}
	AsyncToken.prototype.Resolve = function(data){
		this.Reason = new ResolveReason(data);
		this.Events.FireEvent("OnResolve",[data]);
	}
	AsyncToken.prototype.Clone = function(){
		let token = new AsyncToken(this.Owner);
		token.Reason = this.Reason;
		token.Events = this.Events.Clone();
		return token;
	}
	function BaseReason(data){
		this.Data = data;
	}
	BaseReason.prototype.IsReject = function(){
		return this instanceof RejectReason;
	}
	BaseReason.prototype.IsResolve = function(){
		return this instanceof ResolveReason;
	}
	function RejectReason(data){
		BaseReason.apply(this,[data]);
	}
	RejectReason.prototype = Object.create(BaseReason.prototype);
	function ResolveReason(data){
		BaseReason.apply(this,[data]);
	}
	ResolveReason.prototype = Object.create(BaseReason.prototype);

	
	function EventManager() {
        this.Events = {};
    }
    EventManager.prototype.FireEvent = function(evt, data) {
        let events = this.Events[evt];
		let rtn = true;
        if (events !== undefined) {
            for (let i = 0; i < events.length; i++) {
                let thisRtn = events[i].apply(this, data);
				if(thisRtn === false){
					rtn = false;
				}
            }
        }
		return rtn;
    }
    EventManager.prototype.BindEvent = function(evt, action) {
        if (this.Events[evt] === undefined) {
            this.Events[evt] = [];
        }
        this.Events[evt].push(action);
    }
    EventManager.prototype.UnbindEvent = function(evt, action) {
            if (this.Events[evt] !== undefined) {
                let newArr = [];
                for (let i = 0; i < this.Events[evt].length; i++) {
                    let event = this.Events[evt][i];
                    if (event !== action) {
                        newArr.push(event);
                    }
                }
                this.Events[evt] = newArr;
            }
        }
	EventManager.prototype.Clone = function(){
		var em = new EventManager();
		em.Events = {};
		for(let prop in this.Events){
			em.Events[prop] = this.Events[prop];
		}
		return em;
	}
    // Private functions across module
    function ParseDataAsArray(data) {
        if (Array.isArray(data)) {
            return data;
        }
        if (data.ToArray !== undefined) {
            return data.ToArray();
        }
        if (typeof data === "string") {
            return data.split("");
        }
        return Array.from(data);
    }

    function ParseDataAsEnumerable(data) {
        if (Array.isArray(data)) {
            return new Enumerable({
                Data: data
            });
        }
        // This supports Enumerable,Dictionary,and Lookup
        if (data.ToEnumerable !== undefined) {
            return data.ToEnumerable();
        }
        if (typeof data === "string") {
            return new Enumerable({
                Data: data.split("")
            });
        }
        return new Enumerable({
            Data: Array.from(data)
        });

    }

    function ExtendPrototype(child, parent) {
        let oldConstructor = child.constructor;
        child = Object.create(parent);
        child.constructor = oldConstructor;
    }

    function CreateDataForNewEnumerable(enumerable) {
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

    function ReconstructPredicates(Predicates) {
        let rtn = [];
        for (let i = 0; i < Predicates.length; i++) {
            rtn.push(Predicates[i].Reconstruct());
        }
        return rtn;
    }
	
    function ProcessPredicates(Predicates, data) {
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
                item = Predicate.Execute(item, i, len);
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
    function ProcessPredicatesNoReturn(Predicates, data, terminatingCondition, closureObject) {
        ResetPredicates(Predicates);
		if(closureObject === undefined){
			closureObject = {};
		}
        // No action was specified
        if (!terminatingCondition) {
            return;
        }

        let idx = -1;
        for (let len = data.length, i = 0; i !== len; i++) {
            let item = data[i];
            for (let j = 0, len2 = Predicates.length; j != len2; j++) {
                let Predicate = Predicates[j];
                item = Predicate.Execute(item, i, len);
                if (item === InvalidItem) {
                    break;
                }
            }
            if (item === InvalidItem) {
                continue;
            }
            idx++;
            if (terminatingCondition(idx, item, closureObject) === false) {
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

        // Private variables for module
        scope.Data = [];
        if (privateData.Data !== undefined) {
            scope.Data = privateData.Data.slice();
        }
        scope.Predicates = [];
        if (privateData.Predicates !== undefined) {
            scope.Predicates = privateData.Predicates.slice();
        }
        scope.ForEachActionStack = [new DefaultForEachActionPredicate()];
        if (privateData.ForEachActionStack) {
            scope.ForEachActionStack = privateData.ForEachActionStack.slice();
        }
        if (privateData.NewForEachAction !== undefined) {
            scope.AddToForEachStack(privateData.NewForEachAction);
        }
        if (privateData.NewPredicate !== undefined) {
            scope.AddToPredicateStack(privateData.NewPredicate);
        }
    }
	let DefaultForEachActionPredicate = function(){
		this.Action = function(arr){
			return arr;
		}
		this.Execute = function(arr){
			return this.Action(arr);
		}
	}	
	let ForEachActionPredicate = function(scope, action){
		this.OldForEachActionPredicate = scope.ForEachActionStack[scope.ForEachActionStack.length - 1];

		this.OldPredicates = scope.Predicates.slice();
		scope.Predicates = [];
		this.Action = action;
		this.Execute = function(arr){
            let newArr = this.OldForEachActionPredicate.Execute(arr);
            newArr = ProcessPredicates(this.OldPredicates, newArr);
            newArr = this.Action(newArr);
            return newArr;			
		}
	}
    Enumerable.prototype.AddToForEachStack = function(action) {
        let scope = this;
        scope.ForEachActionStack.push( new ForEachActionPredicate(scope,action) );
    }
    Enumerable.prototype.AddToPredicateStack = function(pred) {
        let scope = this;
        scope.Predicates.push(pred);
    }

    Enumerable.prototype.GetEnumerator = function() {
        return new LazyEnumerator(this);
    }
    Enumerable.prototype[Symbol.iterator] = function() {
        let enumerator = this.GetEnumerator();
        return {
            next: () => {
                enumerator.Next();
                return {
                    value: enumerator.Current,
                    done: enumerator.Done
                };
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
        arr = this.ForEachActionStack[this.ForEachActionStack.length - 1].Execute(arr);
        arr = ProcessPredicates(this.Predicates, arr);
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
            rtn.Add(key, val);
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
            rtn.Add(key, val);
        }
        return rtn;
    }
	Enumerable.prototype.ToJSON = function(){
		let arr = this.ToArray();
		return JSON.stringify(arr);
	}
	Enumerable.prototype.ToString = function(separator){
		let arr = this.ToArray();
		separator = separator || "";
		let rtn = "";
		for(let i = 0; i < arr.length; i++){
			if(i > 0){
				rtn += separator;
			}
			rtn += arr[i].toString();
		}
		return rtn;
	}
	Enumerable.prototype.Memoize = function(){
		let arr = this.ToArray();
		return ParseDataAsEnumerable(arr);
	}
    Enumerable.prototype.ForEach = function(action, closureObject) {
        let arr = this.Data;
        arr = this.ForEachActionStack[this.ForEachActionStack.length - 1].Execute(arr);
        ProcessPredicatesNoReturn(this.Predicates, arr, action, closureObject);
        return;
    }
	Enumerable.prototype.MemoEach = function(cache,action){
		let memo = new MemoizeFunc(cache);
		action = action || function memoEachDoNothing(){};
        this.ForEach(function(i,v){
			let val = memo.Call(v);
			action(val);
		});
	}
	Enumerable.prototype.MemoEachAsync = function(cache,action){
		let pending = new Map();
		let waitList = new Map();
		action = action || function memoEachAsyncDoNothing(){};
		let memo = new MemoizeFuncAsync(cache,action);
		memo.Events.BindEvent("OnResolve", function(val, args){
			let v = args[0];
			if(waitList.has(v)){
				let wait = waitList.get(v);
				for(let i = 0; i < wait.length; i++){
					action(val);
				}
				waitList.delete(v);
			}
			if(pending.has(v)){
				pending.delete(v);
			}
		});
		// Cache was denied, fetch fresh value
		memo.Events.BindEvent("OnReject", function(val, args){
			let v = args[0];
			if(waitList.has(v)){
				let wait = waitList.get(v);
				let first = wait[0];
				if(first !== undefined){
					wait.splice(0,1);
					if(wait.length === 0){
						if(pending.has(v)){
							pending.delete(v);
						}	
					}
					memo.Call(first);
					return;
				}
			}
		});
        this.ForEach(function(i,v){
			if(pending.has(v) === false){
				pending.set(v,true);
				waitList.set(v,[]);
				memo.Call(v);
			} else {
				waitList.get(v).push(v);
			}
		});
	}

    let WherePredicate = function(pred) {
        Reconstructable.apply(this, arguments);
        this.Predicate = pred;
        let scope = this;
        this.Execute = function(item, i) {
            let passed = this.Predicate(item, i);
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
        data.WherePredicate = new WherePredicate(pred);
        return new FilteredEnumerable(data);
    }
    let SelectPredicate = function(pred) {
        Reconstructable.apply(this, arguments);
        this.Predicate = pred;
        this.Execute = function(item, i) {
            return this.Predicate(item, i)
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
        Reconstructable.apply(this, arguments);
        this.Hash = new HashMap(pred);
        this.Predicate = function(item) {
            // returns undefined in failed, otherwise returns the item
            let result = this.Hash.TryAdd(item);
			if(result !== undefined){
				return item;
			}
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
        Reconstructable.apply(this, arguments);
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
        Reconstructable.apply(this, arguments);
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
        Reconstructable.apply(this, arguments);
        this.Took = 0;
        this.TakeCount = cnt;
		this.CanTake = true;
        this.Predicate = function(item) {
            if (this.Took >= this.TakeCount) {
				this.CanTake = false;
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
			this.CanTake = true;
        }
    }
    Enumerable.prototype.Take = function(cnt) {
        let scope = this;
        let data = CreateDataForNewEnumerable(scope);
        data.NewPredicate = new TakePredicate(cnt);
        return new Enumerable(data);
    }
    let TakeWhilePredicate = function(pred) {
        Reconstructable.apply(this, arguments);
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
            while (took < willTake) {
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
        Reconstructable.apply(this, arguments);
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
        Reconstructable.apply(this, arguments);
        this.Predicate = pred;
        this._last = null;
        this._lastIndex = -1;
        this.Execute = function(SCOPE) {
            let arr = SCOPE.ToArray();
            let idx = arr.length - 1;
            if (this.Predicate == null) {
                return {
                Index: idx,
                Last: arr[idx]
				};
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
        Reconstructable.apply(this, arguments);
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
        Reconstructable.apply(this, arguments);
        let scope = this;
        this.Items = items;
        this.Predicate = pred || function(x) {
            return x;
        }
        this.Predicate2 = pred2 || function(x) {
            return x;
        }
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
                if (hash.ContainsFromExtractedValue(val) === false) {
                    let v = hash2.TryAdd(item);
                    if (v !== undefined) {
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
        Reconstructable.apply(this, arguments);
        let scope = this;
        this.Items = items;
        this.Predicate = pred || function(x) {
            return x;
        }
        this.Predicate2 = pred2 || function(x) {
            return x;
        }
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
        Reconstructable.apply(this, arguments);
        let scope = this;
        this.Items = items;
        this.Predicate = pred || function(x) {
            return x;
        }
        this.Predicate2 = pred2 || function(x) {
            return x;
        }
        this.Reset = function() {}
        this.Execute = function(arr) {
            let setA = arr;
            let setB = ParseDataAsArray(items);
            let rtn = []
            let hash = new HashMap(pred);
            for (let i = 0; i < setA.length; i++) {
                let item = setA[i];
                hash.TryAdd(item);
            }

            for (let i = 0; i < setB.length; i++) {
                let item = setB[i];
                let val = this.Predicate2(item);
                if (hash.ContainsFromExtractedValue(val) === false) {
                    rtn.push(item);
                }
            }

            hash = new HashMap(pred2);
            for (let i = 0; i < setB.length; i++) {
                let item = setB[i];
                hash.TryAdd(item);
            }

            for (let i = 0; i < setA.length; i++) {
                let item = setA[i];
                let val = this.Predicate(item);
                if (hash.ContainsFromExtractedValue(val) === false) {
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
    Enumerable.prototype.ContainsSequence = function(sequence) {
        let scope = this;
		let cnt = 0;
		let pred = function(item){
			cnt++;
			if(cnt > 0){
				return false;
			}
			return true;
		}
        scope.SplitBy(sequence).ForEach(pred);
		return cnt > 0;
    }
    Enumerable.prototype.Except = function(items, pred, pred2) {
        let scope = this;
        pred = pred || function(x) {
            return x;
        }
        pred2 = pred2 || function(x) {
            return x;
        }
        let dataToPass = CreateDataForNewEnumerable(scope);

        // Uses hashing algorithm
        dataToPass.NewForEachAction = function(arr) {
            if (arr.length === 0) {
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
                if (set.ContainsFromExtractedValue(val)) {
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
        pred = pred || function(x) {
            return x;
        }
        pred2 = pred2 || function(x) {
            return x;
        }
        let dataToPass = CreateDataForNewEnumerable(scope);

        // Uses hashing algorithm
        dataToPass.NewForEachAction = function(arr) {
            if (arr.length === 0) {
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
                if (set.ContainsFromExtractedValue(val)) {
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
	
	Enumerable.prototype.Slice = function(a,b) {
        if(a === undefined){
			a = 0;
		}	
		if( b === undefined){
			b = POSITIVE_INFINITY;
		}
		return this.Skip(a).Take(b-a);
	}
    Enumerable.prototype.Prepend = function(items) {
        return ParseDataAsEnumerable(items).Concat(this);
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
    let SplitPredicate = function(pred, includeSplitter) {
        let scope = this;
        Reconstructable.apply(this, Array.from(arguments));
        this.Predicate = pred;
        this.IncludeSplitter = includeSplitter;
        this.CurrentGroup = [];
        this.NeedsFlush = false;
        this.Reset = function() {
            this.CurrentGroup = [];
            this.NeedsFlush = false;
        }
        this.Flush = function() {
            this.CurrentGroup = [];
            this.NeedsFlush = false;
        }
        this.Execute = function(item, i, len) {
            if (this.NeedsFlush === true) {
                this.Flush();
            }
            let equal = this.Predicate(i, item);
            if (equal === true) {
                if (this.IncludeSplitter === true) {
                    this.CurrentGroup.push(item);
                }
                this.NeedsFlush = true;
                return ParseDataAsEnumerable(this.CurrentGroup);
            } else {
                this.CurrentGroup.push(item);
            }
            if (i >= len - 1) {
                if (this.CurrentGroup.length > 0) {
                    return ParseDataAsEnumerable(this.CurrentGroup);
                }
            }
        }
    }
    Enumerable.prototype.Split = function(pred, includeSplitter) {
        let scope = this;
        let data = CreateDataForNewEnumerable(scope);
        data.NewPredicate = new SplitPredicate(pred, includeSplitter);
        return new Enumerable(data);
    }

    let SplitByPredicate = function(sequence, pred, includeSplitter) {
        let scope = this;
        Reconstructable.apply(this, Array.from(arguments));
        this.Predicate = pred || function(a, b) {
            return a === b;
        }
        this.IncludeSplitter = includeSplitter;
        this.CurrentGroup = [];
        this.CurrentSequence = [];
        this.Sequence = ParseDataAsArray(sequence);
        this.NeedsFlush = false;

        function concat(a, b) {
            for (let i = 0; i < b.length; i++) {
                a.push(b[i]);
            }
        }
        this.Reset = function() {
            this.CurrentGroup = [];
            this.NeedsFlush = false;
            this.CurrentSequence = [];
        }
        this.Flush = function() {
            this.CurrentGroup = [];
            this.NeedsFlush = false;
            this.CurrentSequence = [];
        }
        this.Execute = function(item, i, len) {
            if (this.NeedsFlush === true) {
                this.Flush();
            }
            this.CurrentSequence.push(item);
            let currentItem = this.Sequence[this.CurrentSequence.length - 1];
            let equal = this.Predicate(item, currentItem);

            if (equal === false) {
                concat(this.CurrentGroup, this.CurrentSequence);
                this.CurrentSequence = [];
            }

            if (equal === true) {
                if (this.CurrentSequence.length === this.Sequence.length) {
                    if (this.IncludeSplitter === true) {
                        concat(this.CurrentGroup, this.CurrentSequence);
                    }
                    this.NeedsFlush = true;
                    return ParseDataAsEnumerable(this.CurrentGroup);
                }
            }
            if (i >= len - 1) {
                if (this.CurrentGroup.length > 0) {
                    return ParseDataAsEnumerable(this.CurrentGroup);
                }
            }
        }
    }
    Enumerable.prototype.SplitBy = function(sequence, pred, includeSplitter) {
        let scope = this;
        let data = CreateDataForNewEnumerable(scope);
        data.NewPredicate = new SplitByPredicate(sequence, pred, includeSplitter);
        return new Enumerable(data);
    }
	
	let BatchPredicate = function(cnt){
        let scope = this;
        Reconstructable.apply(this, Array.from(arguments));
        this.CurrentSequence = [];
		this.BatchSize = cnt;

        this.Reset = function() {
            this.CurrentSequence = [];
        }
        this.Execute = function(item, i, len) {
            
            this.CurrentSequence.push(item);
            if(this.CurrentSequence.length === this.BatchSize){
				let rtn = ParseDataAsEnumerable(this.CurrentSequence.slice());
				this.CurrentSequence = [];
				return rtn;
			}
            if (i >= len - 1) {
                if (this.CurrentSequence.length > 0) {
					let rtn = ParseDataAsEnumerable(this.CurrentSequence.slice());
					this.CurrentSequence = [];
					return rtn;
                }
            }
        }		
	}
	Enumerable.prototype.Batch = function(cnt){
        let scope = this;
        let data = CreateDataForNewEnumerable(scope);
        data.NewPredicate = new BatchPredicate(cnt);
        return new Enumerable(data);		
	}
	
	Enumerable.prototype.BatchAccumulate = function(size){
        let scope = this;
        let data = CreateDataForNewEnumerable(scope);
        data.NewForEachAction = function(arr){
		   let batches = [];
		   for(let v of arr){
			   batches.push([]);
			   let lbound = Math.max(0, batches.length-size);
			   let ubound = batches.length;
			   for(let i = lbound; i < ubound; i++){
					let batch = batches[i];
					if(batch.length < size){
						batch.push(v);
					}
				}					   
		   }	
		   for(let i = 0; i < batches.length; i++){
			   batches[i] = ParseDataAsEnumerable(batches[i]);
		   }
		   return batches;
		}
        return new Enumerable(data);			
	}
    Enumerable.prototype.GroupBy = function(pred) {
        let scope = this;
        let data = CreateDataForNewEnumerable(scope);
        data.GroupingPredicate = pred;
        return new GroupedEnumerable(data);
    }
    Enumerable.prototype.Join = function(data, joinKeysLeft, joinKeysRight, selectPred) {
        let scope = this;
        let dataToPass = CreateDataForNewEnumerable(scope);

        // Uses hash join algorithm
        dataToPass.NewForEachAction = function(arr) {
            if (arr.length === 0) {
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
                if (set.has(leftModel) === false) {
                    set.add(leftModel, [item]);
                } else {
                    let group = set.get(leftModel);
                    group.push(item);
                }
            }

            let rtn = [];
            for (let i = 0; i < lenB; i++) {
                const right = data2[i];
                const rightModel = joinKeysRight(right);
                if (set.has(rightModel) === true) {
                    let group = set.get(rightModel);
                    for (let j = 0; j < group.length; j++) {
                        let left = group[j];
                        if (selectPred !== undefined) {
                            rtn.push(selectPred(left, right));
                        } else {
                            rtn.push(new Joining(left, right));
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
            if (arr.length === 0) {
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
                if (set.has(rightModel) === false) {
                    set.add(rightModel, [item]);
                } else {
                    let group = set.get(rightModel);
                    group.push(item);
                }
            }

            let rtn = [];
            for (let i = 0; i < lenA; i++) {
                const left = arr[i];
                const leftModel = joinKeysLeft(left);
                if (set.has(leftModel) === true) {
                    let group = set.get(leftModel);
                    for (let j = 0; j < group.length; j++) {
                        let right = group[j];
                        if (selectPred !== undefined) {
                            rtn.push(selectPred(left, right));
                        } else {
                            rtn.push(new Joining(left, right));
                        }
                    }
                } else {
                    if (selectPred !== undefined) {
                        rtn.push(selectPred(left, null));
                    } else {
                        rtn.push(new Joining(left, null));
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
            if (arr.length === 0) {
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
                if (set.has(leftModel) === false) {
                    set.add(leftModel, [item]);
                } else {
                    let group = set.get(leftModel);
                    group.push(item);
                }
            }

            let rtn = [];
            for (let i = 0; i < lenB; i++) {
                const right = data2[i];
                const rightModel = joinKeysRight(right);
                if (set.has(rightModel) === true) {
                    let group = set.get(rightModel);
                    for (let j = 0; j < group.length; j++) {
                        let left = group[j];
                        if (selectPred !== undefined) {
                            rtn.push(selectPred(left, right));
                        } else {
                            rtn.push(new Joining(left, right));
                        }
                    }
                } else {
                    if (selectPred !== undefined) {
                        rtn.push(selectPred(null, right));
                    } else {
                        rtn.push(new Joining(null, right));
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
            if (arr.length === 0) {
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
                if (set.has(rightModel) === false) {
                    set.add(rightModel, [item]);
                } else {
                    let group = set.get(rightModel);
                    group.push(item);
                }
            }

            // Do a left join first
            for (let i = 0; i < lenA; i++) {
                const left = arr[i];
                const leftModel = joinKeysLeft(left);
                if (set.has(leftModel) === true) {
                    let group = set.get(leftModel);
                    for (let j = 0; j < group.length; j++) {
                        let right = group[j];
                        if (selectPred !== undefined) {
                            rtn.push(selectPred(left, right));
                        } else {
                            rtn.push(new Joining(left, right));
                        }
                    }
                } else {
                    if (selectPred !== undefined) {
                        rtn.push(selectPred(left, null));
                    } else {
                        rtn.push(new Joining(left, null));
                    }
                }
            }

            set.clear();

            // Fill the set with items from the left side
            for (let i = 0; i < lenA; i++) {
                const item = arr[i];
                const leftModel = joinKeysLeft(item);
                if (set.has(leftModel) === false) {
                    set.add(leftModel, [item]);
                } else {
                    let group = set.get(leftModel);
                    group.push(item);
                }
            }

            // Get the remaining items missing from the right join
            for (let i = 0; i < lenB; i++) {
                const right = data2[i];
                const rightModel = joinKeysRight(right);
                if (set.has(rightModel) === false) {
                    if (selectPred !== undefined) {
                        rtn.push(selectPred(null, right));
                    } else {
                        rtn.push(new Joining(null, right));
                    }
                }
            }
            return rtn;
        }
        return new Enumerable(dataToPass);
    }
    Enumerable.prototype.Count = function(pred) {
        let scope = this;
        if (pred !== undefined) {
            return scope.Where(x => pred(x)).ToArray().length;
        }
        return scope.ToArray().length;
    }
    Enumerable.prototype.IsEmpty = function() {
        let scope = this;
        for (let obj of scope) {
            return false;
        }
        return true;
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
        if (pred !== undefined) {
            return scope.Select(function(x) {
                let val = pred(x) - avg;
                return (val * val);
            }).Sum() / cnt;
        }
        return scope.Select(function(x) {
            let val = x - avg;
            return (val * val);
        }).Sum() / cnt;
    }
    Enumerable.prototype.StdDev = function(pred) {
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
            groups = scope.GroupBy(v => ({
                Value: pred(v)
            }));
        } else {
            groups = scope.GroupBy(v => ({
                Value: v
            }));
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
    Enumerable.prototype.Product = function(pred) {
        let scope = this;
        let arr = scope.ToArray();
        let prod = 1;
        for (let i = 0; i < arr.length; i++) {
            let item = arr[i];
            if (pred) {
                prod *= pred(item);
            } else {
                prod *= item;
            }
        }
        return prod;
    }
    let MaxPredicate = function(pred, level) {
        Reconstructable.apply(this, arguments);
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
                if (item === lastMax) {
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
                return SCOPE.Where(x => pred(x) === max);
            }
            return SCOPE.Where(x => x === max);
        }
        this.MaxBy_N = function(SCOPE) {
            let max = this.Max_N(SCOPE);
            let pred = this.Predicate;
            if (this.Predicate) {
                return SCOPE.Where(x => pred(x) === max);
            }
            return SCOPE.Where(x => x === max);
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
        Reconstructable.apply(this, arguments);
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
                if (item === lastMin) {
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
                return SCOPE.Where(x => pred(x) === min);
            }
            return SCOPE.Where(x => x === min);
        }
        this.MinBy_N = function(SCOPE) {
            let min = this.Min_N(SCOPE);
            let pred = this.Predicate;
            if (this.Predicate) {
                return SCOPE.Where(x => pred(x) === min);
            }
            return SCOPE.Where(x => x === min);
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
        let maxPred = new MaxPredicate(pred, level);
        return new Range(minPred.Min(scope), maxPred.Max(scope));
    }
    Enumerable.prototype.RangeBy = function(pred, level) {
        let scope = this;
        let minPred = new MinPredicate(pred, level);
        let maxPred = new MaxPredicate(pred, level);
        return new Range(minPred.MinBy(scope), maxPred.MaxBy(scope));
    }
    Enumerable.prototype.Aggregate = function(pred, seed) {
        let scope = this;
        let curr = null;
		if(seed !== undefined){
			curr = seed;
		}
        let arr = scope.ToArray();
        for (let i = 0; i < arr.length; i++) {
            let item = arr[i];
            if (curr === null) {
                curr = item;
                continue;
            }
            let val = item;
            curr = pred(curr, val);
        }
        return curr;
    }
    Enumerable.prototype.AggregateRight = function(pred, seed) {
	   return this.Reverse().Aggregate(pred,seed);	
	}
    Enumerable.prototype.OfType = function(type) {
        let scope = this;
        return scope.Where(x => (typeof x) === type);
    }
    Enumerable.prototype.OfInstance = function(type) {
        let scope = this;
        return scope.Where(x => x instanceof type);
    }
	let RemovePredicate = function(items){
		let scope = this;
        Reconstructable.apply(this, Array.from(arguments));
		this.Items = ParseDataAsEnumerable(items);

		this.ItemsToCheck;
        this.Reset = function() {
			scope.Items = scope.Items.Memoize();
			let arr = scope.Items.ToArray();
			scope.ItemsToCheck = new Map();
			for(let i = 0; i < arr.length; i++){
				let v = arr[i];
				if(scope.ItemsToCheck.has(v)){
					scope.ItemsToCheck.get(v).push(v);
				} else {
					scope.ItemsToCheck.set(v, [v]);
				}
			}
        }
        this.Execute = function(item, i, len) {
			if(this.ItemsToCheck.size === 0){
				return item;
			}
			if(this.ItemsToCheck.has(item) === false){
				return item;
			}
			let arr = this.ItemsToCheck.get(item);
			if(arr.length === 1){
				this.ItemsToCheck.delete(item);
			} else {
				this.ItemsToCheck.set(item, arr.slice(0));
			}
			return InvalidItem;
		}        		
	}
	let RemoveAtPredicate = function(idx,cnt){
		let scope = this;
        Reconstructable.apply(this, Array.from(arguments));
		this.Index = idx;
		this.Count = cnt || 1;
		this.RemoveCount = 0;
		this.BeganRemove = false;
        this.Reset = function() {
			this.RemoveCount = 0;
			this.BeganRemove = false;
        }
        this.Execute = function(item, i, len) {
			if(i === this.Index){
				this.BeganRemove = true;
			}
			if(this.BeganRemove === true){
				if(this.RemoveCount < this.Count){
					this.RemoveCount++;
					return InvalidItem;
				}
			}
			return item;
		}        		
	}
	Enumerable.prototype.Remove = function(item){
		return this.RemoveRange([item]);
	}
    Enumerable.prototype.RemoveAt = function(idx, cnt) {
        let scope = this;
        let dataToPass = CreateDataForNewEnumerable(scope);
		dataToPass.NewPredicate = new RemoveAtPredicate(idx,cnt);
		return new Enumerable(dataToPass);
    }
	Enumerable.prototype.RemoveRange = function(items){
		let scope = this;
        let dataToPass = CreateDataForNewEnumerable(scope);	
		dataToPass.NewPredicate = new RemovePredicate(items);
		return new Enumerable(dataToPass);	
	}
    Enumerable.prototype.InsertRange = function(idx, data) {
        let scope = this;
        let dataToPass = CreateDataForNewEnumerable(scope);

        dataToPass.NewForEachAction = function(arr) {
            let rtn = [];
            for (let i = 0; i < arr.length; i++) {
                if (i === idx) {
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
    Enumerable.prototype.InsertAt = function(idx, data) {
        let scope = this;
        return scope.InsertRange(idx, [data]);
    }
    Enumerable.prototype.InsertRangeAt = function(idx, data) {
        let scope = this;
        let dataToPass = CreateDataForNewEnumerable(scope);
        dataToPass.NewForEachAction = function(arr) {
			if(idx === Number.POSITIVE_INFINITY){
				return arr.concat(data);
			}
            let rtn = [];
            for (let i = 0; i < arr.length; i++) {
                if (i === idx) {
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
	let PushPredicate = function(scope,elm){
        this.Elms = [elm];
		let that = this;
		ForEachActionPredicate.apply(this,[scope,function(arr){
			let a = arr.slice();
			return a.concat(that.Elms);
		}]);
	}
    Enumerable.prototype.Push = function(elm) {
        let scope = this;
		let fea = scope.ForEachActionStack[scope.ForEachActionStack.length-1];
		if(fea instanceof PushPredicate){
			fea.Elms.push(elm);
			return this;
		}
        scope.ForEachActionStack.push( new PushPredicate(scope,elm) );
		return this;
    }
	let PopPredicate = function(scope){
        this.PopCount = 1;
		let that = this;
		ForEachActionPredicate.apply(this,[scope,function(arr){
			return arr.slice(0,Math.max(0,arr.length - that.PopCount));
		}]);
	}
    Enumerable.prototype.Pop = function() {
        let scope = this;
		let fea = scope.ForEachActionStack[scope.ForEachActionStack.length-1];
		if(fea instanceof PopPredicate){
			fea.PopCount++;
			return this;
		}
        scope.ForEachActionStack.push( new PopPredicate(scope) );
		return this;
    }
    Enumerable.prototype.Shuffle = function() {
        let scope = this;
        return scope.OrderBy(Enumerable.Functions.ShuffleSort);
    }
    Enumerable.prototype.Scan = function(seed, generator) {
        let scope = this;
        let data = CreateDataForNewEnumerable(scope);
        data.NewForEachAction = function(arr) {
            if (arr.length === 0) {
                return arr;
            }
            let rtn = [];
            let prev = seed || arr[0];
            let curr = prev;
            let startIdx = 0;
            if (prev === null) {
                startIdx = 1;
            }
            for (let i = startIdx; i < arr.length; i++) {
                let item = arr[i];
                let oldCurr = curr;
                curr = generator(prev, curr, i);
                prev = oldCurr;
                rtn.push(curr);
            }
            return rtn;
        }
        return new Enumerable(data);
    }
    let CatchPredicate = function(handler, refPred) {
        Reconstructable.apply(this, arguments);
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
        Reconstructable.apply(this, arguments);
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
		let rtn = "";
        if (!pred) {
            rtn = scope.Aggregate(function(curr, next) {
                return curr + symbol + next;
            });
			return rtn === null ? "" : rtn;
        }
        rtn = scope.Select(pred).Aggregate(function(curr, next) {
            return curr + symbol + next;
        });
		return rtn === null ? "" : rtn;
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
    Enumerable.prototype.SequenceEqual = function(other, comparer) {
        let scope = this;
        var a1 = scope.ToArray();
        var a2 = ParseDataAsArray(other);
        if (a1.length !== a2.length) {
            return false;
        }
        for (let i = 0; i < a1.length; i++) {
            let itemA = a1[i];
            let itemB = a2[i];
            if (comparer !== undefined) {
                if (comparer(itemA, itemB) === false) {
                    return false;
                }
            } else {
                if (itemA !== itemB) {
                    return false;
                }
            }
        }
        return true;
    }
    Enumerable.prototype.SequenceEqualUnordered = function(other, keyLeft, keyRight) {
        let scope = this;
        var a1 = scope.ToArray();
        var a2 = ParseDataAsArray(other);
        if (a1.length === 0 && a2.length === 0) {
            return true;
        }
        if (a1.length === 0 && a2.length !== 0 || a1.length !== 0 && a2.length === 0) {
            return false;
        }

        const model = keyLeft(a1[0]);
        const set = new NestedSet(model);
        const lenA = a1.length;
        const lenB = a2.length;

        for (let i = 0; i < lenA; i++) {
            const item = a1[i];
            const leftModel = keyLeft(item);
            if (set.has(leftModel) === false) {
                set.add(leftModel, [item]);
            }
        }
        for (let i = 0; i < lenB; i++) {
            const item = a2[i];
            const rightModel = keyRight(item);
            if (set.has(rightModel) === false) {
                return false;
            }
        }
        return true;
    }
    Enumerable.prototype.Sequence = function(cnt, seed, generator) {
        let scope = this;
        let data = {
            Data: scope.Data,
            Predicates: scope.Predicates,
            ForEachActionStack: scope.ForEachActionStack
        };
        data.NewForEachAction = function(arr) {
            let rtn = arr;
            let newEnum = PublicEnumerable.Sequence(cnt, seed, generator).ToArray();
            return rtn.concat(newEnum);
        }
        return new Enumerable(data);
    }
    Enumerable.prototype.AsyncParallel = function(interval) {
        return new AsyncParallel(this, interval);
    }
    Enumerable.prototype.AsyncSequential = function() {
        return new AsyncSequential(this);
    }
	
    
	let AsyncParallel = function(enumerable, interval) {
		this.Token = new AsyncToken(this);
        this.Enumerator = new EnumeratorCollection();
		this.Enumerator.AddItems(enumerable);
        this.Interval = interval;
        this.Canceled = false;
		this.CompleteCount = 0;
		this.TotalCount = 0;
        this.Action = null;
        this.Events = new EventManager();
    }
    AsyncParallel.prototype.ForEach = function(action) {
        let scope = this;
		let completed = false;
		let rejected = false;
		scope.Token.Events.BindEvent("OnResolve", (data)=>{
			scope.CompleteCount++;
			if(rejected === true){
				return;
			}
			scope.Events.FireEvent("OnResolve", [data]);
			tryOnComplete();
		});
		scope.Token.Events.BindEvent("OnReject", (data)=>{
			if(rejected === true){
				return;
			}
			rejected = true;
			scope.Events.FireEvent("OnReject", [data]);
			return;		
		});
		scope.Events.BindEvent("OnComplete", function(data){
			completed = true;
		});
		
		let tryOnComplete = function(){
			if(completed === true || rejected === true){
				return false;
			}
			if(scope.CompleteCount === scope.TotalCount && scope.Enumerator.Current === undefined){
				scope.Events.FireEvent("OnComplete");
				return false;
			}
			return true;			
		}
        let Iteration = function() {
			setTimeout(function asyncForEachIteration() {
				let next = scope.Enumerator.Next();
				// Not finished yet
				if (next.Value !== undefined) {
					scope.TotalCount++;
					let token = scope.Token.Clone();
					try{
						action(next.Value,token);
						Iteration();
					}
					catch(e){
						try{
							// Fire the OnError event, which let's us know if we should continue
							scope.Events.FireEvent("OnError",[e,token]);
							if(token.Reason.IsReject() === false){
								Iteration();
							}
						}
						catch(e2){
							token.Reject(e2);
						}
					}
				} else {
					scope.Events.FireEvent("OnEnumerationComplete", []);
					tryOnComplete();
					return;
				}
			}, scope.Interval);
        }
		
		//Kick off the events
        Iteration();
		return scope.Token;
    }
	AsyncParallel.prototype.Then = function(item){
		this.Enumerator.AddItem(item);
		return this;
	}
	AsyncParallel.prototype.Catch = function(handler){
		this.Events.BindEvent("OnError",handler);
		return this;
	}
	AsyncParallel.prototype.Finally = function(onDone){
		this.Events.BindEvent("OnComplete",onDone);	
		return this;
	}
	AsyncParallel.prototype.FinallyEnumerated = function(onDone){
		this.Events.BindEvent("OnEnumerationComplete",onDone);		
		return this;
	}
	
	let AsyncSequential = function(enumerable){
		this.Token = new AsyncToken(this);
        this.Enumerator = new EnumeratorCollection();
		this.Enumerator.AddItems(enumerable);
        this.Events = new EventManager();		
	}
    AsyncSequential.prototype.ForEach = function(action) {
        let scope = this;
		let rejected = false;
		scope.Token.Events.BindEvent("OnResolve", (data)=>{
			if(rejected === true){
				return;
			}
			scope.Events.FireEvent("OnResolve", [data]);
			if(scope.Enumerator.Current === undefined){
				scope.Events.FireEvent("OnComplete", [scope.Token.Reason.Data]);
				return;
			}
			Iteration();			
		});
		
		scope.Token.Events.BindEvent("OnReject", (data)=>{
			if(rejected === true){
				return;
			}
			rejected = true;
			scope.Events.FireEvent("OnReject", [data]);
			return;		
		});
		
		let Iteration = function(){
			if(rejected === true){
				return;
			}
			let next = scope.Enumerator.Next();
			if(next.Value === undefined){
				scope.Events.FireEvent("OnComplete", [scope.Token.Reason.Data]);
				return;				
			}
			try{
				action(next.Value,scope.Token);
			} 
			catch(e){
				try{
					// Fire the OnError event, which let's us know if we should continue
					scope.Events.FireEvent("OnError",[e,scope.Token]);
				}
				catch(e2){
					scope.Token.Reject(e2);
				}
			}
		}
		Iteration();
		return scope.Token;
    }
	AsyncSequential.prototype.Then = function(item){
		this.Enumerator.AddItem(item);
		return this;
	}
	AsyncSequential.prototype.Catch = function(handler){
		this.Events.BindEvent("OnError",handler);
		return this;
	}
	AsyncSequential.prototype.Finally = function(onDone){
		this.Events.BindEvent("OnComplete",onDone);	
		return this;
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
                if (set.has(groupModel) === false) {
                    let group = new GroupInternal(groupModel);
                    set.add(groupModel, group);
                    groups.push(group);
                    groupsIdx.set(group, groups.length - 1);
                    group.Items.push(item);
                } else {
                    let group = set.get(groupModel);
                    group.Items.push(item);
                }
            }
            for (let i = 0; i < groups.length; i++) {
                let group = groups[i];
                groups[i] = new Group(group.Key, group.Items);
            }
            set.clear();
            return groups;
        }
        this.AddToForEachStack(function(arr) {
            return GroupingFunc(arr);
        });
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

    function Dictionary() {
        this._map = new Map();
        Enumerable.apply(this, [
            []
        ]);
    }
    Dictionary.prototype = Object.create(Enumerable.prototype);
    Object.defineProperty(Dictionary.prototype, "Data", {
        get: function getData() {
            return this.ToArray();
        },
        set: function setData() {

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
    Dictionary.prototype.ForEach = function(action) {
        let scope = this;
        let keys = scope.GetKeys().ToArray();
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            let val = scope._map.get(key);
            let kvp = new KeyValuePair(key, val);
            let result = action(i, kvp);
            if (result === false) {
                break;
            }
        }
    }
    Dictionary.prototype.ContainsKey = function(key) {
        return this._map.has(key);
    }
    Dictionary.prototype.ContainsValue = function(val) {
        let scope = this;
        let result = false;
        scope.ForEach(function(i, kvp) {
            if (kvp.Value === val) {
                result = true;
                return false;
            }
        });
        return result;
    }
    Dictionary.prototype.Get = function(key) {
        let scope = this;
        if (scope._map.has(key) === false) {
            throw new Error("Dictionary does not contain the given key: " + key);
        }
        return scope._map.get(key);
    }
    Dictionary.prototype.Set = function(key, value) {
        let scope = this;
        scope._map.set(key, value);
    }
    Dictionary.prototype.Add = function(key, value) {
        let scope = this;
        if (scope._map.has(key)) {
            throw new Error("Dictionary already contains the given key: " + key);
        }
        scope._map.set(key, value);
    }
    Dictionary.prototype.Clear = function() {
        this._map.clear();
    }
    Dictionary.prototype.Remove = function(key) {
        this._map.delete(key);
    }
    Dictionary.prototype.ToArray = function() {
        let arr = [];
        this.ForEach((i, kvp) => {
            arr.push(kvp);
        });
        return arr;
    }
    Dictionary.prototype.ToEnumerable = function() {
        let arr = this.ToArray();
        return ParseDataAsEnumerable(arr);
    }
    Dictionary.prototype.GetEnumerator = function() {
        return new MapEnumerator(this._map);
    }
    Dictionary.prototype[Symbol.iterator] = function() {
        let enumerator = this.GetEnumerator();
        return {
            next: () => {
                enumerator.Next();
                return {
                    value: enumerator.Current,
                    done: enumerator.Done
                };
            }
        };
    }
	Dictionary.prototype.Clone = function(){
		var dict = new Dictionary();
		dict._map = new Map(this._map);
		return dict;
	}

    function Lookup() {
        Dictionary.apply(this, []);
        let scope = this;
    }
    Lookup.prototype = Object.create(Dictionary.prototype);
    Lookup.prototype.ContainsValue = function(val) {
        let scope = this;
        let result = false;
        scope.ForEach(function(kvp) {
            if (kvp.Value.Contains(val) > -1) {
                result = true;
                return false;
            }
        });
        return result;
    }
    Lookup.prototype.Add = function(key, value) {
        let scope = this;
        if (scope._map.has(key) === false) {
            scope._map.set(key, ParseDataAsEnumerable([]));
        }
        scope._map.get(key).Data.push(value);
    }
    Lookup.prototype.Set = function(key, value) {
        let scope = this;
        let val = ParseDataAsEnumerable(value);
        scope._map.set(key, val);
    }
	Lookup.prototype.Clone = function(){
		var dict = new Lookup();
		dict._map = new Map(this._map);
		return dict;
	}
    // Static methods for Enumerable
    PublicEnumerable.Extend = function(extenderMethod) {
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
		step = step || 1;
        return PublicEnumerable.Range(start, count, -step);
    }
    PublicEnumerable.Empty = function() {
        return PublicEnumerable.From([]);
    }
    PublicEnumerable.Sequence = function(cnt, generator, seed) {
        let arr = [];
        seed = seed || [];
        arr = seed.splice();
		let i = 0;
        while(arr.length != cnt){
            let newVal = generator(i,arr);
			if(newVal !== InvalidItem){
				arr.push(newVal);
			}
			i++;
        }
        return ParseDataAsEnumerable(arr);
    }
    PublicEnumerable.Until = function(generator, seed) {
        let arr = [];
        seed = seed || [];
        arr = seed.splice();
		let i = 0;
        while(true){
            let newVal = generator(i,arr);
			if(newVal !== InvalidItem){
				arr.push(newVal);
			} else {
				return ParseDataAsEnumerable(arr);				
			}
			i++;
        }
    }
	PublicEnumerable.Combinations = function(data, subsetSize){
		function getSubsets(superSet,  k,  idx, current, solution) {
			//successful stop clause
			if (current.length== k) {
				solution.push(ParseDataAsEnumerable(current));
				return;
			}
			//unseccessful stop clause
			if (idx == superSet.length) return;
			let x = superSet[idx];
			current.push(x);
			//"guess" x is in the subset
			getSubsets(superSet, k, idx+1, current, solution);
			current.pop();
			//"guess" x is not in the subset
			getSubsets(superSet, k, idx+1, current, solution);
		}
		let rtn = [];
		let arr = ParseDataAsArray(data);
		getSubsets(arr, subsetSize, 0, [], rtn);
		return ParseDataAsEnumerable(rtn);
	}
    PublicEnumerable.Inherit = function(object, dataGetter) {
            for (let prop in Enumerable.prototype) {

                if (typeof Enumerable.prototype[prop] !== "function") {
                    continue;
                }
                object.prototype[prop] = function() {
                    let data = dataGetter(this);
                    let enumerable = ParseDataAsEnumerable(data);
                    return enumerable[prop].apply(enumerable, Array.from(arguments));
                }
            }
            object.prototype[Symbol.iterator] = function() {
                let enumerator = this.GetEnumerator();
                return {
                    next: () => {
                        enumerator.Next();
                        return {
                            value: enumerator.Current,
                            done: enumerator.Done
                        };
                    }
                };
            }
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

    // Misc code
    for (let prop in Enumerable.prototype) {
        Group.prototype[prop] = function() {
            return this.Items[prop].apply(this.Items, Array.from(arguments));
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
