
'use strict';
var Enumerable = (function() {
    // Private constant variables for module
    var FOR_EACH_ACTION_STACK_REF = function(arr) {
        return arr;
    };
    var InvalidItem;
    // Private Classes for module
    function Group(key) {
        this.Key = key;
        this.Items = [];
    }
    // the module API
    function PublicEnumerable(data) {
		var d = ParseDataAsArray(data);
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
		throw Error("Could not parse the input to an array");
	}
	function ParseDataAsEnumerable(data){
		if(data.hasOwnProperty("length")){
			return new Enumerable({Data: data});
		}
		if(data.ToArray){
			return data;
		}
		throw Error("Could not parse the input to an enumerable");
	}	
	function ResetPredicates(Predicates){
		for (var i = 0; i < Predicates.length; i++) {
			var pred = Predicates[i];
			pred.Reset();
		}
	}
    function CreateGuid() {
        var alphabet = "abcdefghijklmnnopqrstuvwxyz0123456789".split("");
        var guid = "";
        for (var i = 0; i < 5; i++) {
            for (var j = 0; j < 4; j++) {
                var idx = Math.floor(alphabet.length * Math.random());
                var letter = alphabet[idx];
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
		var scope = this;
		this.ExtractValue = function(obj){
			if(scope.Predicate){
				return scope.Predicate(obj);
			}
			return obj;
		}
		this.ContainsItem = function(obj){
			var val = this.ExtractValue(obj);
			return this.ContainsFromExtractedValue(val);
		}
		this.ContainsFromExtractedValue = function(val){
			if( typeof val === "object" ){
				var id = val[scope.PROPERTY_FOR_HASHING];				
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
			var val = scope.ExtractValue(obj);
			if( typeof val === "object" ){
				var id = val[scope.PROPERTY_FOR_HASHING];				
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
		
		// Flushes the hash and outputs as array
		this.Flush = function(){
			var rtn = this.Array;
			this.Clear();
			return rtn;
		}
		
		this.Clear = function(){
			var hash = scope.Hash;
			var keys = Object.keys(hash);
			for(var i = 0; i < keys.length; i++){
				var key = keys[i];
				var item = hash[key];
				delete item[scope.PROPERTY_FOR_HASHING];
			}	
			scope.Hash = {};
			scope.Array = [];
		}

	}
    var OrderPredicate = function(pred, desc) {
        this.SortFunctions = [];
        var scope = this;
        this.SortComparer = null;
        this.Composite = function(newPred, newDesc) {
            if (this.SortComparer === null) {
                if (desc) {
                    this.SortComparer = function(a, b) {
                        var val1 = newPred(a);
                        var val2 = newPred(b);
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
                        var val1 = newPred(a);
                        var val2 = newPred(b);
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
            var oldSort = this.SortComparer;
            if (newDesc) {
                this.SortComparer = function(a, b) {
                    var oldRes = oldSort(a, b);
                    if (oldRes !== 0) {
                        return oldRes;
                    }
                    var val1 = newPred(a);
                    var val2 = newPred(b);
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
                    var oldRes = oldSort(a, b);
                    if (oldRes !== 0) {
                        return oldRes;
                    }
                    var val1 = newPred(a);
                    var val2 = newPred(b);
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
        var scope = this;
        var argsToApply = [{
            Data: privateData.Data,
            ForEachActionStack: privateData.ForEachActionStack,
            Predicates: privateData.Predicates,
            Scope: scope
        }];
        Enumerable.apply(this, argsToApply);
        // Private variables for module
        var Descending = privateData.Descending;
        var SortComparer = privateData.SortComparer;
        var SortingPredicate = new OrderPredicate(SortComparer, Descending);
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

    function GroupedEnumerable(privateData) {
        var scope = this;
        var argsToApply = [{
            Data: privateData.Data,
            ForEachActionStack: privateData.ForEachActionStack,
            Predicates: privateData.Predicates,
            Scope: scope
        }];
        Enumerable.apply(this, argsToApply);
        // Private variables for module
        var pred = privateData.GroupingPredicate;
        this.AddToForEachStack(function(arr) {
            var groups = [];
            var groupsIdx = [];
            for (var i = 0; i < arr.length; i++) {
                var item = arr[i];
                var key = pred(item);
                if (groupsIdx[key] == undefined) {
                    groupsIdx[key] = groups.length;
                    groups.push(new Group(key));
                }
                var idx = groupsIdx[key];
                groups[idx].Items.push(item);
            }
            arr = groups;
            return arr;
        });
        this.ThenBy = function(pred) {
            this.AddToForEachStack(function(arr) {
                var groups = [];
                for (var i = 0; i < arr.length; i++) {
                    var groups2 = [];
                    var groupsIdx2 = [];
                    var group = arr[i];
                    for (var j = 0; j < group.Items.length; j++) {
                        var item = group.Items[j];
                        var key = pred(item);
                        if (groupsIdx2[key] == undefined) {
                            groupsIdx2[key] = groups2.length;
                            groups2.push(new Group(key));
                        }
                        var idx = groupsIdx2[key];
                        groups2[idx].Items.push(item);
                    }
                    group.Items = groups2;
                    groups.push(group);
                }
                arr = groups;
                return arr;
            });
            return this;
        }
    };
    function FilteredEnumerable(privateData) {
        var scope = this;
        var argsToApply = [{
            Data: privateData.Data,
            ForEachActionStack: privateData.ForEachActionStack,
            Predicates: privateData.Predicates,
            Scope: scope
        }];
        Enumerable.apply(this, argsToApply);
        // Private variables for module
        var WherePredicate = privateData.WherePredicate;
		
        this.AddToPredicateStack(WherePredicate);
		
		function Composite(pred){
			// Remove the old WherePredicate from the stack
			var preds = scope.Predicates.splice(0,scope.Predicates.length-1);
            var newArgs = {Data: scope.Data,ForEachActionStack:scope.ForEachActionStack,Predicates:preds};
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
    var Enumerable = function(privateData) {
        var scope = this;
        // Private methods for module
        scope.AddToForEachStack = function(action) {
            var oldFeA = scope.ForEachActionStack;
            var oldPredicate = scope.Predicates.slice();
            scope.Predicates = [];
            scope.ForEachActionStack = function(arr) {
                var newArr = oldFeA(arr);
                newArr = scope.ProcessPredicates(oldPredicate, newArr);
                newArr = action(newArr);
                return newArr;
            }
        }
        scope.AddToPredicateStack = function(pred) {
            scope.Predicates.push(pred);
        }
        scope.ProcessPredicates = function(Predicates, data, terminatingCondition) {
            ResetPredicates(Predicates);
			
            if (Predicates.length === 0 && !terminatingCondition) {
                return data;
            }
			
			if(terminatingCondition === undefined){
				var arr = [];
				var idx = -1;
				for (var len = data.length, i = 0; i !== len; i++) {
					var item = data[i];
					for (var j = 0, len2 = Predicates.length; j != len2; j++) {
						var Predicate = Predicates[j];
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
			
            var arr = [];
            var idx = -1;
            for (var len = data.length, i = 0; i !== len; i++) {
                var item = data[i];
                for (var j = 0, len2 = Predicates.length; j != len2; j++) {
                    var Predicate = Predicates[j];
                    item = Predicate.Execute(item);
                    if (item === InvalidItem) {
                        break;
                    }
                }
                if (item !== InvalidItem) {
                    idx++;
                    if (terminatingCondition !== null) {
                        if (terminatingCondition(idx, item) === false) {
                            return arr;
                        }
                    }
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
        scope.ForEachActionStack = privateData.ForEachActionStack || FOR_EACH_ACTION_STACK_REF;
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
            var arr = scope.ToArray();
            return new Enumerable({
                Data: arr
            });
        }
        scope.ToArray = function() {
            //console.log("Original ToArray");
            return scope.ForEach();
        }
        scope.ToDictionary = function(predKey, predVal) {
            var arr = scope.ToArray();
            var rtn = {};
            for (var i = 0; i < arr.length; i++) {
                var item = arr[i];
                var key = predKey(item).toString();
                var val = predVal(item);
                if (rtn[key] !== undefined) {
                    throw Error("Dictionary already contains the specified key: " + key);
                }
                rtn[key] = val;
            }
            return rtn;
        }
        scope.ForEach = function(action) {
            //console.log("Original ForEach");
            var arr = scope.Data;
            arr = scope.ForEachActionStack(arr);
            arr = scope.ProcessPredicates(scope.Predicates, arr, action);
            return arr;
        }
		var AndPredicate = function(pred){
			this.Predicate = pred;
			this.Execute = function(firstVal, item){
				return firstVal && this.Predicate(item);
			}
		}
		var SplitAndPredicate = function(pred){
			AndPredicate.apply(this,[pred]);
		}
		var OrPredicate = function(pred){
			this.Predicate = pred;
			this.Execute = function(firstVal, item){
				return firstVal || this.Predicate(item);
			}			
		}
		var SplitOrPredicate = function(pred){
			OrPredicate.apply(this,[pred]);
		}

        var WherePredicate = function(pred) {
            this.Predicate = pred;
			this.ChainedPredicates = [new OrPredicate(pred)];
			var scope = this;
			this.lastResult = false;
			var initialResult = false;
			function Composite(p){
				var clone = new WherePredicate(scope.Predicate);
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
				for(var i = 0; i <scope.ChainedPredicates.length; i++){
					var p = scope.ChainedPredicates[i];
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
                var passed = this.Predicate(item);
                if (passed) {
                    return item;
                }
                return InvalidItem;
            }
            this.Reset = function() {}
        }
        scope.Where = function(pred) {
            var data = {
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
        var SelectPredicate = function(pred) {
            this.Predicate = pred;
            this.Execute = function(item) {
                return this.Predicate(item)
            }
            this.Reset = function() {}
        }
        scope.Select = function(pred) {
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewPredicate = new SelectPredicate(pred);
            return new Enumerable(data);
        }
        scope.SelectMany = function(pred, selectPred) {
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
			data.NewForEachAction = function(arr){
				var sPred = new SelectPredicate(pred);	
				var rtn = [];
				for(var i = 0; i < arr.length; i++){
					var item = arr[i];
					var selected = sPred.Execute(item);
					selected = ParseDataAsArray(selected);
					for(var j = 0; j < selected.length; j++){
						var jItem = selected[j];
						var converted = selectPred(item,jItem);
						rtn.push(converted);
					}
				}
				return rtn;
			}
            return new Enumerable(data);
        }
        var DistinctPredicate = function(pred) {
			this.Hash = new HashMap(pred);
            this.Predicate = function(item) {
				// returns undefined in failed, otherwise returns the item
				var result = this.Hash.TryAdd(item);
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
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            var distinctHash = [];
            data.NewPredicate = new DistinctPredicate(pred);
            return new Enumerable(data);
        }
        var SkipPredicate = function(cnt) {
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
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewPredicate = new SkipPredicate(cnt);
            return new Enumerable(data);
        }
        var SkipWhilePredicate = function(pred) {
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
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewPredicate = new SkipWhilePredicate(pred);
            return new Enumerable(data);
        }
        var TakePredicate = function(cnt) {
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
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewPredicate = new TakePredicate(cnt);
            return new Enumerable(data);
        }
        var TakeWhilePredicate = function(pred) {
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
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewPredicate = new TakeWhilePredicate(pred);
            return new Enumerable(data);
        }
        scope.TakeExceptLast = function(cnt) {
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            cnt = cnt || 1;
            data.NewForEachAction = function(arr) {
                var newArr = [];
                var take = arr.length - cnt;
                for (var i = 0; i < take; i++) {
                    newArr.push(arr[i]);
                }
                return newArr;
            }
            return new Enumerable(data);
        }
        scope.TakeLast = function(cnt) {
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
                var rtn = [];
                var idx = arr.length;
                var took = 0;
                var willTake = Math.min(cnt, arr.length);
                while (took < cnt || idx > 0) {
                    idx--;
                    took++;
                    var item = arr[idx];
                    var rtnIdx = willTake - took;
                    rtn[rtnIdx] = item;
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        scope.TakeLastWhile = function(pred) {
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
                var rtn = [];
                var idx = arr.length;
                while (idx > 0) {
                    idx--;
                    var item = arr[idx];
                    if (!pred(item)) {
                        break;
                    }
                    rtn.push(item);
                }
                return rtn.reverse();
            }
            return new Enumerable(data);
        }
        var FirstPredicate = function(pred) {
            var SCOPE = this;
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
            var that = this;
            if (this._predicate == null) {
                this.Predicate = this.NULL_PRED_METHOD;
            } else {
                this.Predicate = this.PRED_METHOD;
            }
            this.Execute = function(SCOPE) {
                SCOPE.ForEach(this.Predicate);
                var idx = this._firstIndex;
                var first = this._first;
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
            var p = new FirstPredicate(pred);
            return p.Execute(scope).First;
        }
        scope.Single = function(pred) {
            return scope.First(pred);
        }
        var LastPredicate = function(pred) {
            this.Predicate = pred;
            this._last = null;
            this._lastIndex = -1;
            this.Execute = function(SCOPE) {
                var arr = SCOPE.ToArray();
                var idx = arr.length - 1;
                if (this.Predicate == null) {
                    return arr[idx];
                }
                while (idx > -1) {
                    var item = arr[idx];
                    if (this.Predicate(item)) {
                        this._last = item;
                        this._lastIndex = idx;
                        break;
                    }
                    idx--;
                }
                var idx = this._lastIndex;
                var last = this._last;
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
            var p = new LastPredicate(pred);
            return p.Execute(scope).Last;
        }
        scope.IndexOf = function(item) {
            var pred = function(x) {
                return x == item;
            }
            var p = new FirstPredicate(pred);
            return p.Execute(scope).Index;
        }
        scope.LastIndexOf = function(item) {
            var arr = scope.ToArray();
            return arr.lastIndexOf(item);
        }
        scope.OrderBy = function(pred) {
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack,
                Descending: false,
                SortComparer: pred
            };
            return new OrderedEnumerable(data);
        }
        scope.OrderByDescending = function(pred) {
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack,
                Descending: true,
                SortComparer: pred
            };
            return new OrderedEnumerable(data);
        }
        scope.Any = function(pred) {
            var first = scope.First(pred);
            return first !== null;
        }
        var AllPredicate = function(pred) {
            this._predicate = pred;
            this._all = true;
			var scope = this;
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
            var p = new AllPredicate(pred);
            return p.Execute(scope);
        }
        scope.Contains = function(item) {
            return scope.IndexOf(item) > -1;
        }
        scope.Except = function(items) {
			var itemArr = ParseDataAsArray(items);
            return scope.Where(x => itemArr.indexOf(x) == -1);
        }
        scope.Not = function(pred) {
            return scope.Where(x => !pred(x));
        }
		var UnionPredicate = function(items,pred){
			var scope = this;
			this.Items = items;
			this.Predicate = pred;
			this.Reset = function(){}
			this.Execute = function(arr){
				var items = ParseDataAsArray(scope.Items);
				var hash = new HashMap(pred);
				for(var i = 0; i < arr.length; i++){
					var item = arr[i];
					hash.TryAdd(item);
				}
				for(var i = 0; i < items.length; i++){
					var item = items[i];
					hash.TryAdd(item);
				}	
				var flush = hash.Flush();
				return flush;
			}
		}
        scope.Union = function(items, pred) {
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
				var p = new UnionPredicate(items,pred);
				return p.Execute(arr);
			}
			return new Enumerable(data);
        }
		var IntersectPredicate = function(items,pred){
			var scope = this;
			this.Items = items;
			this.Predicate = pred;
			this.Reset = function(){}
			this.Execute = function(arr){
				var rtn = [];
				var items = ParseDataAsArray(scope.Items);
				var hash1 = new HashMap(pred);
				var hash2 = new HashMap(pred);
				for(var i = 0; i < arr.length; i++){
					var item = arr[i];
					hash1.TryAdd(item);
				}
				for(var i = 0; i < items.length; i++){
					var item = items[i];
					var val = hash2.ExtractValue(item);

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
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
				var p = new IntersectPredicate(items,pred);
				return p.Execute(arr);
			}
			return new Enumerable(data);
        }
		var DisjointPredicate = function(items,pred){
			var scope = this;
			this.Items = items;
			this.Predicate = pred;
			this.Reset = function(){}
			this.Execute = function(arr){
				var items = scope.Items;
				var pred = scope.Predicate;
				var itemArr = ParseDataAsArray(items);
                var rtn = [];
                var hash = new HashMap(pred);
                var dqed = new HashMap(pred);
                for (var i = 0; i < arr.length; i++) {
                    var item = arr[i];
					var result = hash.TryAdd(item);
					if(result === undefined){
						continue;
					}
					var val = hash.ExtractValue(item);
					var flagOut = false;
					for(var j = 0; j < itemArr.length; j++){
						var jItem = itemArr[j];
						var jVal = hash.ExtractValue(jItem);
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
                for (var i = 0; i < itemArr.length; i++) {
                    var item = itemArr[i];
					var val = hash.ExtractValue(item);
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
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
				var p = new DisjointPredicate(items,pred);
				return p.Execute(arr);
            }
            return new Enumerable(data);
        }
        scope.Concat = function(items) {
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
				var itemArr = ParseDataAsArray(items);
                var rtn = arr.concat(itemArr);
                return rtn;
            }
            return new Enumerable(data);
        }
        scope.Zip = function(items, pred) {
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
                var rtn = [];
				var itemArr = ParseDataAsArray(items);
                for (var i = 0; i < arr.length; i++) {
                    var itemA = arr[i];
                    if (i >= itemArr.length) {
                        return rtn;
                    }
                    var itemB = itemArr[i];
                    var newItem = pred(itemA, itemB);
                    rtn.push(newItem);
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        scope.ZipUneven = function(items, pred) {
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
                var rtn = [];
				var itemArr = ParseDataAsArray(items);
                var maxLen = Math.max(arr.length, itemArr.length);
                for (var i = 0; i < maxLen; i++) {
                    if (i >= arr.length) {
                        rtn.push(itemArr[i]);
                        continue;
                    }
                    if (i >= itemArr.length) {
                        rtn.push(arr[i]);
                        continue;
                    }
                    var itemA = arr[i];
                    var itemB = itemArr[i];
                    var newItem = pred(itemA, itemB);
                    rtn.push(newItem);
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        scope.Reverse = function() {
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
                var rtn = [];
                for (var i = arr.length - 1; i > -1; i--) {
                    rtn.push(arr[i]);
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        scope.GroupBy = function(pred) {
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.GroupingPredicate = pred;
            return new GroupedEnumerable(data);
        }
        scope.Join = function(data, propA, propB, selectObj) {
            var dataToPass = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            dataToPass.NewForEachAction = function(arr) {
                var data2 = (data.ToArray ? data.ToArray() : data);
                var rtn = [];
                for (var i = 0; i < arr.length; i++) {
                    var item = arr[i];
                    var a = propA(item);
                    for (var j = 0; j < data2.length; j++) {
                        var item2 = data2[j];
                        var b = propB(item2);
                        if (a == b) {
                            var obj = selectObj(item, item2);
                            rtn.push(obj);
                        }
                    }
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
            var arr = scope.ToArray();
            var sum = 0;
            for (var i = 0; i < arr.length; i++) {
                var item = arr[i];
                if (pred) {
                    sum += pred(item);
                } else {
                    sum += item;
                }
            }
            return sum / arr.length;
        }
        scope.Median = function(pred) {
            var values = [];
            if (pred) {
                values = scope.Select(pred).ToArray();
            } else {
                values = scope.ToArray();
            }
            values.sort(function(a, b) {
                return a - b;
            });
            var half = Math.floor(values.length / 2);
            if (values.length % 2) {
                return values[half];
            } else {
                return (values[half - 1] + values[half]) / 2.0;
            }
        }
        scope.Mode = function(pred, level) {
            var groups = [];
            level = level || 0;
            if (pred) {
                groups = scope.GroupBy(v => pred(v));
            } else {
                groups = scope.GroupBy(v => v);
            }
            return groups.MaxBy(g => g.Items.length, level);
        }
        scope.Sum = function(pred) {
            var arr = scope.ToArray();
            var sum = 0;
            for (var i = 0; i < arr.length; i++) {
                var item = arr[i];
                if (pred) {
                    sum += pred(item);
                } else {
                    sum += item;
                }
            }
            return sum;
        }
        var MaxPredicate = function(pred, level) {
            this.Level = level || 0;
            this.Predicate = pred;
            this.MaxFirst = function(SCOPE) {
                var max = Number.NEGATIVE_INFINITY;
                var arr = SCOPE.ToArray();
                var pred = this.Predicate;
                for (var i = 0; i < arr.length; i++) {
                    var item = arr[i];
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
                var arr = SCOPE.ToArray();
                var level = this.Level;
                if (this.Predicate) {
                    var pred = this.Predicate;
                    arr.sort(function(a, b) {
                        var aa = pred(a);
                        var bb = pred(b);
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
                var max = arr[0];
                if (this.Predicate) {
                    max = this.Predicate(max);
                }
                var lastMax = max;
                for (var i = 1; i < arr.length; i++) {
                    var item = arr[i];
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
                var max = this.Max(SCOPE);
                var pred = this.Predicate;
                if (this.Predicate) {
                    return SCOPE.Where(x => pred(x) == max);
                }
                return SCOPE.Where(x => x == max);
            }
            this.MaxBy_N = function(SCOPE) {
                var max = this.Max_N(SCOPE);
                var pred = this.Predicate;
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
            var maxPred = new MaxPredicate(pred, level);
            return maxPred.Max(scope);
        }
        scope.MaxBy = function(pred, level) {
            var maxPred = new MaxPredicate(pred, level);
            return maxPred.MaxBy(scope);
        }
        var MinPredicate = function(pred, level) {
            this.Level = level || 0;
            this.Predicate = pred;
            this.MinFirst = function(SCOPE) {
                var min = Number.POSITIVE_INFINITY;
                var arr = SCOPE.ToArray();
                var pred = this.Predicate;
                for (var i = 0; i < arr.length; i++) {
                    var item = arr[i];
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
                var arr = SCOPE.ToArray();
                var level = this.Level;
                if (this.Predicate) {
                    var pred = this.Predicate;
                    arr.sort(function(a, b) {
                        var aa = pred(a);
                        var bb = pred(b);
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
                var lastMin = min;
                for (var i = 1; i < arr.length; i++) {
                    var item = arr[i];
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
                var min = this.Min(SCOPE);
                var pred = this.Predicate;
                if (this.Predicate) {
                    return SCOPE.Where(x => pred(x) == min);
                }
                return SCOPE.Where(x => x == min);
            }
            this.MinBy_N = function(SCOPE) {
                var min = this.Min_N(SCOPE);
                var pred = this.Predicate;
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
            var minPred = new MinPredicate(pred, level);
            return minPred.Min(scope);
        }
        scope.MinBy = function(pred, level) {
            var minPred = new MinPredicate(pred, level);
            return minPred.MinBy(scope);
        }
        scope.Aggregate = function(pred, seed) {
            var curr = seed || null;
            var arr = scope.ToArray();
            for (var i = 0; i < arr.length; i++) {
                var item = arr[i];
                if (curr == null) {
                    curr = item;
                    continue;
                }
                var val = item;
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
            var dataToPass = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            dataToPass.NewForEachAction = function(arr) {
                var rtn = [];
                for (var i = 0; i < arr.length; i++) {
                    if (i == idx) {
                        for (var j = 0; j < data.length; j++) {
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
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
                var rtn = [];
                for (var i = 0; i < cnt; i++) {
                    var idx = Math.floor(arr.length * Math.random());
                    rtn.push(arr[idx]);
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        scope.Cycle = function(cnt) {
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
                var rtn = [];
                for (var i = 0; i < cnt; i++) {
                    var idx = i % arr.length;
                    rtn.push(arr[idx]);
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        scope.Repeat = function(elm, cnt) {
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
                var rtn = arr.slice();
                for (var i = 0; i < cnt; i++) {
                    rtn.push(elm);
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        scope.ElementAt = function(idx) {
            var arr = scope.ToArray();
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
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = function(arr) {
                var rtn = arr.slice();
                for (var i = 0; i < cnt; i++) {
                    rtn.push(generator(i));
                }
                return rtn;
            }
            return new Enumerable(data);
        }
        var CatchPredicate = function(handler, refPred) {
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
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates.slice(),
                ForEachActionStack: scope.ForEachActionStack
            };
            var oldPredicate = data.Predicates.pop();
            data.NewPredicate = new CatchPredicate(handler, oldPredicate);
            return new Enumerable(data);
        }
        var TracePredicate = function(msg) {
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
            var data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            var oldPredicate = data.Predicate;
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
            var privData = {
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
			var d = ParseDataAsArray(data);
            return new PublicEnumerable(d);
        }
        // Public Static Methods
    PublicEnumerable.Range = function(start, count, step) {
        var arr = [];
        step = step || 1;
        var curr = start;
        for (var i = 0; i < count; i++) {
            arr.push(curr);
            curr += step;
        }
        return PublicEnumerable.From(arr);
    }
    PublicEnumerable.RangeTo = function(start, to, step) {
        var arr = [];
        step = step || 1;
        var sign = 1;
        if (to < start) {
            sign = -1;
            start *= -1;
            to *= -1;
        }
        for (var i = start; i <= to; i += step) {
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
                var aa = pred(a);
                var bb = pred(b);
                return Enumerable.Functions.SortDesc(aa, bb);
            }
        }
        return function(a, b) {
            var aa = pred(a);
            var bb = pred(b);
            return Enumerable.Functions.SortAsc(aa, bb);
        }
    }
    Enumerable.CreateCompositeSortFunction = function(oldComparer, pred, desc) {
        var newSort = Enumerable.CreateSortFunction(pred, desc);
        return function(a, b) {
            var initialResult = oldComparer(a, b);
            if (initialResult !== 0) {
                return initialResult;
            }
            return newSort(a, b);
        } 
    }
    // Create a short-hand, plus NoConflict
    var _Old = window._;
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
