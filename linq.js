
'use strict';
let Enumerable = (function() {
    // Private constant variables for module
    let FOR_EACH_ACTION_STACK_REF = function(arr) {
        return arr;
    };
    let InvalidItem;
    // Private Classes for module
    function Group(key) {
        this.Key = key;
        this.Items = [];
    }
    // the module API
    function PublicEnumerable(data) {
		let d = ParseDataAsArray(data);
        return new Enumerable({
            Data: d
        });
    }
    // Private functions across module
	function ParseDataAsArray(data){
		if(data.hasOwnProperty("length")){
			return data;
		}
		if(data.ToArray){
			return data.ToArray();
		}
		try {
			return Array.from(data);			
		}
		catch(e){}
		throw Error("Could not parse the input to an array");
	}
	function ParseDataAsEnumerable(data){
		if(data.hasOwnProperty("length")){
			return new Enumerable({Data: data});
		}
		if(data.ToArray){
			return data;
		}
		try {
			return new Enumerable({Data: Array.from(data)});			
		}
		catch(e){}
		throw Error("Could not parse the input to an enumerable");
	}	
	function ResetPredicates(Predicates){
		for (let i = 0; i < Predicates.length; i++) {
			let pred = Predicates[i];
			pred.Reset();
		}
	}
	function ProcessPredicatesNoReturn(Predicates,data,terminatingCondition){
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
    function CreateGuid() {
        let alphabet = "abcdefghijklmnnopqrstuvwxyz0123456789".split("");
        let guid = "";
        for (let i = 0; i < 5; i++) {
            for (let j = 0; j < 4; j++) {
                let idx = Math.floor(alphabet.length * Math.random());
                let letter = alphabet[idx];
                guid += letter;
            }
            if (i < 4) {
                guid += "-";
            }
        }
        return guid;
    }

	function HashMap(pred){
		this.Hash = {};
		this.Array = [];
		this.Predicate = pred;
		this.PROPERTY_FOR_HASHING = "HASH_CHECK_" + CreateGuid();
		let scope = this;
		this.ExtractValue = function(obj){
			if(scope.Predicate){
				return scope.Predicate(obj);
			}
			return obj;
		}
		this.ContainsItem = function(obj){
			let val = this.ExtractValue(obj);
			return this.ContainsFromExtractedValue(val);
		}
		function GetHashKeyFromObj(obj){
			let val = scope.ExtractValue(obj);
			return GetHashKeyFromVal(val);
		}
		function GetHashKeyFromVal(val){
			if( typeof val === "object" ){
				return val[scope.PROPERTY_FOR_HASHING];				
			} else {
				return val;
			}		
		}
		this.ContainsFromExtractedValue = function(val){
			if( typeof val === "object" ){
				let id = val[scope.PROPERTY_FOR_HASHING];				
				if(id === undefined ){
					return false;
				}
				if( this.Hash[id] === undefined ){
					return false;
				}
				return true;
			} else {
				if(scope.Hash[val] === undefined){
					return false;
				}
				return true;
			}			
		}
		this.TryAdd = function(obj){
			let val = scope.ExtractValue(obj);
			if( typeof val === "object" ){
				let id = val[scope.PROPERTY_FOR_HASHING];				
				//If the id is undefined, that means the object was never added
				if(id === undefined){
					id = CreateGuid();
					val[scope.PROPERTY_FOR_HASHING] = id;
					scope.Hash[id] = obj;
					scope.Array.push(obj);
					return val;
				}
			} else {
				if(scope.Hash[val] === undefined){
					scope.Hash[val] = obj;
					scope.Array.push(obj);
					return val;
				}
			}
			return undefined;
		}
		this.GetHashKeyOrInsertNew = function(obj){
			let key = GetHashKeyFromObj(obj);
			if(key !== undefined){
				return key;
			}
			let val = this.TryAdd(obj);
			return GetHashKeyFromVal(val);
		}
		
		// Flushes the hash and outputs as array
		this.Flush = function(){
			let rtn = this.Array;
			this.Clear();
			return rtn;
		}
		
		this.Clear = function(){
			let hash = scope.Hash;
			let keys = Object.keys(hash);
			for(let i = 0; i < keys.length; i++){
				let key = keys[i];
				let item = hash[key];
				delete item[scope.PROPERTY_FOR_HASHING];
			}	
			scope.Hash = {};
			scope.Array = [];
		}

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

	function GroupKeyMeta(property, predicate){
		this.Property = property;
		this.Predicate = predicate;
	}
    function GroupedEnumerable(privateData) {
        const scope = this;
        let argsToApply = [{
            Data: privateData.Data,
            ForEachActionStack: privateData.ForEachActionStack,
            Predicates: privateData.Predicates,
            Scope: scope
        }];
        Enumerable.apply(this, argsToApply);
        // Private variables for module
        let pred = privateData.GroupingPredicate;
		this.GroupingPredicates = pred;
		

		this.GroupingFunc = function(arr){
			if(arr.length === 0){
				return arr;
			}
			let objHashing = new HashMap();
            let groups = [];
            let groupsIdx = [];
			let firstItem = this.GroupingPredicates(arr[0]);
			let groupingKeys = Object.keys(firstItem);
            for (let i = 0; i < arr.length; i++) {
                let item = arr[i];
				let key = "";
				let groupKey = this.GroupingPredicates(item);
				for(let j = 0; j < groupingKeys.length; j++){
					if(key.length > 0){
						key += ",";
					}
					key += objHashing.GetHashKeyOrInsertNew(groupKey[groupingKeys[j]]);
				}
                if (groupsIdx[key] === undefined) {
                    groupsIdx[key] = groups.length;
                    groups.push(new Group(groupKey));
                }
                let idx = groupsIdx[key];
                groups[idx].Items.push(item);
            }
            arr = groups;
			objHashing.Clear();
            return arr;			
		}
        this.AddToForEachStack(function(arr) {
			return scope.GroupingFunc(arr);
        });
    };
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
		
		function Composite(pred){
			// Remove the old WherePredicate from the stack
			let preds = scope.Predicates.splice(0,scope.Predicates.length-1);
            let newArgs = {Data: scope.Data,ForEachActionStack:scope.ForEachActionStack,Predicates:preds};
			newArgs.WherePredicate = pred;
            return new FilteredEnumerable(newArgs);			
		}
        this.Or = function(pred) {
			return Composite(WherePredicate.Or(pred));
        };
        this.And = function(pred) {
			return Composite(WherePredicate.And(pred));
        };		
		this.SplitAnd = function(pred){
			return Composite(WherePredicate.SplitAnd(pred));
		}
		this.SplitOr = function(pred){
			return Composite(WherePredicate.SplitOr(pred));
		}
    }
    // The private constructor. Define EVERYTHING in here
    let Enumerable = function(privateData) {
        let scope = this;
        // Private methods for module
        scope.AddToForEachStack = function(action) {
            let oldFeA = scope.ForEachActionStack[scope.ForEachActionStack.length-1];
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
        scope.Data = privateData.Data || [];
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
        scope.IsInvalidItem = function(item) {
            return item == InvalidItem;
        }
        scope.ToEnumerable = function() {
            let arr = scope.ToArray();
            return new Enumerable({
                Data: arr
            });
        }
        scope.ToArray = function() {
            let arr = scope.Data;
            arr = scope.ForEachActionStack[scope.ForEachActionStack.length-1](arr);
            arr = scope.ProcessPredicates(scope.Predicates, arr);
            return arr;
        }
        scope.ToDictionary = function(predKey, predVal) {
            let arr = scope.ToArray();
            let rtn = {};
            for (let i = 0; i < arr.length; i++) {
                let item = arr[i];
                let key = predKey(item).toString();
                let val = predVal(item);
                if (rtn[key] !== undefined) {
                    throw Error("Dictionary already contains the specified key: " + key);
                }
                rtn[key] = val;
            }
            return rtn;
        }
        scope.ForEach = function(action) {
            let arr = scope.Data;
            arr = scope.ForEachActionStack[scope.ForEachActionStack.length-1](arr);
            ProcessPredicatesNoReturn(scope.Predicates, arr, action);
			return;
        }
		let AndPredicate = function(pred){
			this.Predicate = pred;
			this.Execute = function(firstVal, item){
				return firstVal && this.Predicate(item);
			}
		}
		let SplitAndPredicate = function(pred){
			AndPredicate.apply(this,[pred]);
		}
		let OrPredicate = function(pred){
			this.Predicate = pred;
			this.Execute = function(firstVal, item){
				return firstVal || this.Predicate(item);
			}			
		}
		let SplitOrPredicate = function(pred){
			OrPredicate.apply(this,[pred]);
		}

        let WherePredicate = function(pred) {
            this.Predicate = pred;
			this.ChainedPredicates = [new OrPredicate(pred)];
			let scope = this;
			this.lastResult = false;
			let initialResult = false;
			function Composite(p){
				let clone = new WherePredicate(scope.Predicate);
				clone.ChainedPredicates = scope.ChainedPredicates.slice();
				clone.ChainedPredicates.push(p);
				clone.Execute = clone.ChainedExecute;
				return clone;
			}
			this.Or = function(p){
				return Composite(new OrPredicate(p));
			}
			this.And = function(p){
				return Composite(new AndPredicate(p));
			}
			this.SplitAnd = function(p){
				return Composite(new SplitAndPredicate(p));			
			}
			this.SplitOr = function(p){
				return Composite( new SplitOrPredicate(p));					
			}
			scope.ChainedExecute = function(item){
				scope.lastResult = initialResult;
				for(let i = 0; i <scope.ChainedPredicates.length; i++){
					let p = scope.ChainedPredicates[i];
					if(scope.lastResult === false){
						//(false) && is always false
						if(p instanceof SplitAndPredicate){
							return InvalidItem;
						}
						//(false && ) may not be false if there is a || following
						else if(p instanceof AndPredicate){
							continue;
						}
					} else {
						//(true) || is always true
						if(p instanceof SplitOrPredicate){
							return item;
						} 
						//(true || ) may be false if there is an &&. ex: ((true || false) && false)
						else if(p instanceof OrPredicate){
							continue;
						}
					}
					scope.lastResult = p.Execute(scope.lastResult,item);
				
				}
				return scope.lastResult ? item : InvalidItem;
			}
            this.Execute = function(item) {
                let passed = this.Predicate(item);
                if (passed) {
                    return item;
                }
                return InvalidItem;
            }
            this.Reset = function() {}
        }
        scope.Where = function(pred) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
			if(!pred){
				pred = function(item){
					return false;
				}
			}
            data.WherePredicate = new WherePredicate(pred);
            return new FilteredEnumerable(data);
        }
        let SelectPredicate = function(pred) {
            this.Predicate = pred;
            this.Execute = function(item) {
                return this.Predicate(item)
            }
            this.Reset = function() {}
        }
        scope.Select = function(pred) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewPredicate = new SelectPredicate(pred);
            return new Enumerable(data);
        }
        scope.SelectMany = function(pred, selectPred) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
			data.NewForEachAction = function(arr){
				let sPred = new SelectPredicate(pred);	
				let rtn = [];
				for(let i = 0; i < arr.length; i++){
					let item = arr[i];
					let selected = sPred.Execute(item);
					selected = ParseDataAsArray(selected);
					for(let j = 0; j < selected.length; j++){
						let jItem = selected[j];
						let converted = selectPred(item,jItem);
						rtn.push(converted);
					}
				}
				return rtn;
			}
            return new Enumerable(data);
        }
        let DistinctPredicate = function(pred) {
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
        scope.Distinct = function(pred) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            let distinctHash = [];
            data.NewPredicate = new DistinctPredicate(pred);
            return new Enumerable(data);
        }
        let SkipPredicate = function(cnt) {
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
        scope.Skip = function(cnt) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewPredicate = new SkipPredicate(cnt);
            return new Enumerable(data);
        }
        let SkipWhilePredicate = function(pred) {
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
        scope.SkipWhile = function(pred) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewPredicate = new SkipWhilePredicate(pred);
            return new Enumerable(data);
        }
        let TakePredicate = function(cnt) {
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
        scope.Take = function(cnt) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewPredicate = new TakePredicate(cnt);
            return new Enumerable(data);
        }
        let TakeWhilePredicate = function(pred) {
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
        scope.TakeWhile = function(pred) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewPredicate = new TakeWhilePredicate(pred);
            return new Enumerable(data);
        }
        scope.TakeExceptLast = function(cnt) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
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
        scope.TakeLast = function(cnt) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
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
        scope.TakeLastWhile = function(pred) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
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
        scope.First = function(pred) {
            let p = new FirstPredicate(pred);
            return p.Execute(scope).First;
        }
        scope.Single = function(pred) {
            return scope.First(pred);
        }
        let LastPredicate = function(pred) {
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
        scope.Last = function(pred) {
            let p = new LastPredicate(pred);
            return p.Execute(scope).Last;
        }
        scope.IndexOf = function(item) {
            let pred = function(x) {
                return x == item;
            }
            let p = new FirstPredicate(pred);
            return p.Execute(scope).Index;
        }
        scope.LastIndexOf = function(item) {
            let arr = scope.ToArray();
            return arr.lastIndexOf(item);
        }
        scope.OrderBy = function(pred) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack,
                Descending: false,
                SortComparer: pred
            };
            return new OrderedEnumerable(data);
        }
        scope.OrderByDescending = function(pred) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack,
                Descending: true,
                SortComparer: pred
            };
            return new OrderedEnumerable(data);
        }
        scope.Any = function(pred) {
            let first = scope.First(pred);
            return first !== null;
        }
        let AllPredicate = function(pred) {
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
        scope.All = function(pred) {
            if (pred == null) {
                return true;
            }
            let p = new AllPredicate(pred);
            return p.Execute(scope);
        }
        scope.Contains = function(item) {
            return scope.IndexOf(item) > -1;
        }
        scope.Except = function(items) {
			let itemArr = ParseDataAsArray(items);
            return scope.Where(x => itemArr.indexOf(x) == -1);
        }
        scope.Not = function(pred) {
            return scope.Where(x => !pred(x));
        }
		let UnionPredicate = function(items,pred){
			let scope = this;
			this.Items = items;
			this.Predicate = pred;
			this.Reset = function(){}
			this.Execute = function(arr){
				let items = ParseDataAsArray(scope.Items);
				let hash = new HashMap(pred);
				for(let i = 0; i < arr.length; i++){
					let item = arr[i];
					hash.TryAdd(item);
				}
				for(let i = 0; i < items.length; i++){
					let item = items[i];
					hash.TryAdd(item);
				}	
				let flush = hash.Flush();
				return flush;
			}
		}
        scope.Union = function(items, pred) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
				let p = new UnionPredicate(items,pred);
				return p.Execute(arr);
			}
			return new Enumerable(data);
        }
		let IntersectPredicate = function(items,pred){
			let scope = this;
			this.Items = items;
			this.Predicate = pred;
			this.Reset = function(){}
			this.Execute = function(arr){
				let rtn = [];
				let items = ParseDataAsArray(scope.Items);
				let hash1 = new HashMap(pred);
				let hash2 = new HashMap(pred);
				for(let i = 0; i < arr.length; i++){
					let item = arr[i];
					hash1.TryAdd(item);
				}
				for(let i = 0; i < items.length; i++){
					let item = items[i];
					let val = hash2.ExtractValue(item);

					if(hash2.ContainsFromExtractedValue(val)){
						continue;
					}
					if(hash1.ContainsFromExtractedValue(val) === false){
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
        scope.Intersect = function(items, pred) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
				let p = new IntersectPredicate(items,pred);
				return p.Execute(arr);
			}
			return new Enumerable(data);
        }
		let DisjointPredicate = function(items,pred){
			let scope = this;
			this.Items = items;
			this.Predicate = pred;
			this.Reset = function(){}
			this.Execute = function(arr){
				let items = scope.Items;
				let pred = scope.Predicate;
				let itemArr = ParseDataAsArray(items);
                let rtn = [];
                let hash = new HashMap(pred);
                let dqed = new HashMap(pred);
                for (let i = 0; i < arr.length; i++) {
                    let item = arr[i];
					let result = hash.TryAdd(item);
					if(result === undefined){
						continue;
					}
					let val = hash.ExtractValue(item);
					let flagOut = false;
					for(let j = 0; j < itemArr.length; j++){
						let jItem = itemArr[j];
						let jVal = hash.ExtractValue(jItem);
						if(hash.ContainsFromExtractedValue(jVal)){
							dqed.TryAdd(jItem);
							flagOut = true;
							break;							
						}
					}
                    if (flagOut) {
                        continue;
                    }
                    rtn.push(item);
                }
                for (let i = 0; i < itemArr.length; i++) {
                    let item = itemArr[i];
					let val = hash.ExtractValue(item);
                    if (!hash.ContainsFromExtractedValue(val) && !hash.ContainsFromExtractedValue(val)) {
                        hash.TryAdd(item);
                        rtn.push(item);
                    }
                }
				hash.Clear();
				dqed.Clear();
                return rtn;
			}			
		}
        scope.Disjoint = function(items, pred) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
				let p = new DisjointPredicate(items,pred);
				return p.Execute(arr);
            }
            return new Enumerable(data);
        }
        scope.Concat = function(items) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
				let itemArr = ParseDataAsArray(items);
                let rtn = arr.concat(itemArr);
                return rtn;
            }
            return new Enumerable(data);
        }
        scope.Zip = function(items, pred) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
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
        scope.ZipUneven = function(items, pred) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
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
        scope.Reverse = function() {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
                let rtn = [];
                for (let i = arr.length - 1; i > -1; i--) {
                    rtn.push(arr[i]);
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        scope.GroupBy = function(pred) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.GroupingPredicate = pred;
            return new GroupedEnumerable(data);
        }
        scope.Join = function(data, propA, propB, selectObj) {
            let dataToPass = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            dataToPass.NewForEachAction = function(arr) {
                let data2 = (data.ToArray ? data.ToArray() : data);
                let rtn = [];
                for (let i = 0; i < arr.length; i++) {
                    let item = arr[i];
                    let a = propA(item);
                    for (let j = 0; j < data2.length; j++) {
                        let item2 = data2[j];
                        let b = propB(item2);
                        if (a === b) {
                            let obj = selectObj(item, item2);
                            rtn.push(obj);
                        }
                    }
                }
                arr = rtn;
                return arr;
            }
            return new Enumerable(dataToPass);
        }
		scope.LeftJoin = function(data, propA, propB, selectObj,leftObj) {
            let dataToPass = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            dataToPass.NewForEachAction = function(arr) {
                let data2 = (data.ToArray ? data.ToArray() : data);
                let rtn = [];
				let left = [];
                for (let i = 0; i < arr.length; i++) {
                    let item = arr[i];
					let found = false;
                    let a = propA(item);
                    for (let j = 0; j < data2.length; j++) {
                        let item2 = data2[j];
                        let b = propB(item2);
                        if (a === b) {
                            let obj = selectObj(item, item2);
                            rtn.push(obj);
							found = true;
							continue;
                        }
                    }
					if(found === false){
						left.push(item);
					}
                }
				//Left Join
				for(let i = 0; i < left.length; i++){
					let item = left[i];
					let obj = leftObj(item);
					rtn.push(obj);
				}
                arr = rtn;
                return arr;
            }
            return new Enumerable(dataToPass);
        }
		scope.RightJoin = function(data, propA, propB, selectObj,rightObj) {
            let dataToPass = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            dataToPass.NewForEachAction = function(arr) {
                let data2 = (data.ToArray ? data.ToArray() : data);
                let rtn = [];
				let right = [];
                for (let i = 0; i < data2.length; i++) {
                    let item2 = data2[i];
					let found = false;
                    let b = propB(item2);
                    for (let j = 0; j < arr.length; j++) {
                        let item = arr[j];
                        let a = propA(item);
                        if (a === b) {
                            let obj = selectObj(item, item2);
                            rtn.push(obj);
							found = true;
							continue;
                        }
                    }
					if(found === false){
						right.push(item);
					}
                }
				//Right Join
				for(let i = 0; i < right.length; i++){
					let item = right[i];
					let obj = rightObj(item);
					rtn.push(obj);
				}
                arr = rtn;
                return arr;
            }
            return new Enumerable(dataToPass);
        }
		scope.FullJoin = function(data, propA, propB, selectObj,leftObj,rightObj) {
            let dataToPass = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            dataToPass.NewForEachAction = function(arr) {
                let data2 = (data.ToArray ? data.ToArray() : data);
				let left = [];
				let right = [];
				
				// First, process the matches
                let rtn = [];
                for (let i = 0; i < arr.length; i++) {
                    let item = arr[i];
                    let a = propA(item);
					let found = false;
                    for (let j = 0; j < data2.length; j++) {
                        let item2 = data2[j];
                        let b = propB(item2);
                        if (a == b) {
                            let obj = selectObj(item, item2);
                            rtn.push(obj);
							found = true;
							continue;
                        }
                    }
					if(found === false){
						left.push(item);
					}
                }
                for (let i = 0; i < data2.length; i++) {
                    let item2 = data2[i];
					let found = false;
                    let b = propB(item2);
                    for (let j = 0; j < arr.length; j++) {
                        let item = arr[j];
                        let a = propA(item);
                        if (a === b) {
							found = true;
							break;
                        }
                    }
					if(found === false){
						right.push(item);
					}
                }
				//Left Join
				for(let i = 0; i < left.length; i++){
					let item = left[i];
					let obj = leftObj(item);
					rtn.push(obj);
				}
				//Right Join
				for(let i = 0; i < right.length; i++){
					let item = right[i];
					let obj = rightObj(item);
					rtn.push(obj);
				}
                arr = rtn;
                return arr;
            }
            return new Enumerable(dataToPass);
        }
        scope.Count = function() {
            return scope.ToArray().length;
        }
        scope.Average = function(pred) {
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
        scope.Median = function(pred) {
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
        scope.Mode = function(pred, level) {
            let groups = [];
            level = level || 0;
            if (pred) {
                groups = scope.GroupBy(v => pred(v));
            } else {
                groups = scope.GroupBy(v => v);
            }
            return groups.MaxBy(g => g.Items.length, level);
        }
        scope.Sum = function(pred) {
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
        scope.Max = function(pred, level) {
            let maxPred = new MaxPredicate(pred, level);
            return maxPred.Max(scope);
        }
        scope.MaxBy = function(pred, level) {
            let maxPred = new MaxPredicate(pred, level);
            return maxPred.MaxBy(scope);
        }
        let MinPredicate = function(pred, level) {
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
        scope.Min = function(pred, level) {
            let minPred = new MinPredicate(pred, level);
            return minPred.Min(scope);
        }
        scope.MinBy = function(pred, level) {
            let minPred = new MinPredicate(pred, level);
            return minPred.MinBy(scope);
        }
        scope.Aggregate = function(pred, seed) {
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
        scope.OfType = function(type) {
            return scope.Where(x => (typeof x) == type);
        }
        scope.OfInstance = function(type) {
            return scope.Where(x => x instanceof type);
        }
        scope.Insert = function(idx, data) {
            return scope.InsertRange(idx, [data]);
        }
        scope.InsertRange = function(idx, data) {
            let dataToPass = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
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
        scope.Choice = function(cnt) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
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
        scope.Cycle = function(cnt) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
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
        scope.Repeat = function(elm, cnt) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
                let rtn = arr.slice();
                for (let i = 0; i < cnt; i++) {
                    rtn.push(elm);
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        scope.ElementAt = function(idx) {
            let arr = scope.ToArray();
            return arr[idx];
        }
        scope.Push = function(elm) {
            return scope.Concat([elm]);
        }
        scope.Pop = function() {
            return scope.TakeExceptLast(1);
        }
        scope.Shuffle = function() {
            return scope.OrderBy(Enumerable.Functions.ShuffleSort);
        }
        scope.Sequence = function(cnt, generator) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
                let rtn = arr.slice();
                for (let i = 0; i < cnt; i++) {
                    rtn.push(generator(i));
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        let CatchPredicate = function(handler, refPred) {
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
        scope.Catch = function(handler) {
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
        scope.Trace = function(msg) {
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            let oldPredicate = data.Predicate;
            data.NewPredicate = new TracePredicate();
            return new Enumerable(data);
        }
        scope.Write = function(symbol, pred) {
            if (!pred) {
                return scope.Aggregate(function(curr, next) {
                    return curr + symbol + next;
                });
            }
            return scope.Select(pred).Aggregate(function(curr, next) {
                return curr + symbol + next;
            });
        }
        scope.WriteLine = function(pred) {
            return scope.Write("\r\n", pred);
        }
        scope.Clone = function() {
            let privData = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            return new Enumerable(privData)
        }
    };
    Enumerable.prototype = PublicEnumerable.prototype;
	
    PublicEnumerable.prototype.Extend = function(extenderMethod) {
        extenderMethod(Enumerable);
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
            curr += step;
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
		if(window._ !== PublicEnumerable){
			return PublicEnumerable;
		}
		if(_Old !== undefined){
		    window._ = _Old;	
		} else {
			delete window._;
		}
        return PublicEnumerable;
    }
    return PublicEnumerable;
}());
