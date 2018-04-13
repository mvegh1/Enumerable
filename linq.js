let Enumerable = ((() => {
	let _Old = undefined;
    // Private constant variables for module

    function CloneArray(arr){
		return arr instanceof Array ? arr.slice() : Array.from(arr);
	}


    // Private Classes for module
    class BasePredicate{
		constructor(argsObj){
			for (var _len = argsObj.length, args = Array(_len), _key = 0; _key < _len; _key++) {
			  args[_key] = argsObj[_key];
			}			
			this._Arguments = args;
		}
		//workaround until code can be fully ported to classes. Max/Min are only obstacles currently
		static Apply(argsObj){
			for (var _len = argsObj.length, args = Array(_len), _key = 0; _key < _len; _key++) {
			  args[_key] = argsObj[_key];
			}				
			this._Arguments = args;
			this.Reconstruct = function(){
	            return new this.constructor(...this._Arguments);
			}
		}
        Reconstruct() {
	        return new this.constructor(...this._Arguments);
        }
    }
	class Enum{
		constructor(){
			let args = _.From(CloneArray(arguments)).Select(x=>x.toString());
			let dupes = args.Duplicate();
			if(dupes.Any()){
				throw new Error(`Duplicate values in enumeration: ${dupes.ToString()}`);
			}
			this.All = args.ToArray();
			for(let i = 0; i < this.All.length; i++){
				this[this.All[i]] = i;
			}
			Object.freeze(this);
		}
		GetString(val){
			return this.All[val];
		}
		GetValue(string){
			for(let i = 0; i < this.All.length;i++){
				if(this.All[i] == string){
					return i;
				}
			}
			return -1;
		}
	}
    class GroupInternal{
		constructor(key){
			this.Key = key;
			this.Items = [];
		}
    }

    class Group{
		constructor(key, data){
			this.Key = key;
			this.Items = ParseDataAsEnumerable(data);
		}
		toString(){
			return `${this.Key}:[${this.Items.Write(",")}]`
		}
    }

    class Range{
		constructor(min, max){
			this.Min = min;
			this.Max = max;
		}
		toString(){
			return `(${this.Min},${this.Max})`;
		}
    }

    class KeyValuePair{
		constructor(key, value){
			this.Key = key;
			this.Value = value;
		}
		toString(){
			return `${this.Key}:${this.Value}`;
		}
    }

    class Joining{
		constructor(left, right){
			this.Left = left;
			this.Right = right;
		}
		toString(){
			let left = "";
			if(this.Left != null){
				left = this.Left.toString();
			}
			let right = "";
			if(this.Right != null){
				right = this.Right.toString();
			}
			return `[${left},${right}]`;
		}
    }

    class HashMap {
        constructor(pred) {
            this.Hash = new Map();
            this.Predicate = pred;
        }

        ExtractValue(obj) {
            if (this.Predicate) {
                return this.Predicate(obj);
            }
            return obj;
        }

        Contains(obj) {
            let val = this.ExtractValue(obj);
            return this.Hash.has(val);
        }

        ContainsFromExtractedValue(val) {
            return this.Hash.has(val);
        }

        TryAdd(obj) {
            let val = this.ExtractValue(obj);
            if (this.Hash.has(val)) {
                return undefined;
            }
            this.Hash.set(val, obj);
            return val;
        }

        Delete(obj) {
            let val = this.ExtractValue(obj);
            this.Hash.delete(val);
        }

        GetHashKeyOrInsertNew(obj) {
            let val = this.ExtractValue(obj);
            if (this.Hash.has(val)) {
                return val;
            }
            this.Hash.set(val, obj);
            return val;
        }

        // Flushes the hash and outputs as array
        Flush() {
            let rtn = CloneArray(this.Hash.values());
            this.Clear();
            return rtn;
        }

        Clear() {
            this.Hash.clear();
        }
    }

    class NestedSet {
        constructor(model) {
            this.Model = model;
            this.Keys = Object.keys(this.Model);
            this.len = this.Keys.length;
            this.breakPt = this.len - 1;
            this.Map = new Map();
        }

        has(obj) {
            return this.get(obj) !== undefined;
        }

        get(obj) {
            let map = this.Map;
            for (let i = 0; i < this.len; i++) {
                let key = this.Keys[i];
                let val = obj[key];
                if (map.has(val)) {
                    if (i === this.breakPt) {
                        return map.get(val);
                    }
                    map = map.get(val);
                } else {
                    return undefined;
                }
            }
            return undefined;
        }

        add(obj, saveVal) {
            let map = this.Map;
            for (let i = 0; i < this.len; i++) {
                let key = this.Keys[i];
                let val = obj[key];
                if (map.has(val) === false) {
                    if (i === this.breakPt) {
                        map.set(val, saveVal);
                        return;
                    } else {
                        map.set(val, new Map());
                        map = map.get(val);
                    }
                } else {
                    if (i === this.breakPt) {
                        return;
                    } else {
                        map = map.get(val);
                    }
                }
            }
        }

        clear() {
            this.Map.clear();
        }
    }

    class EnumeratorItem {
		constructor(val, done){
			this.Value = val;
			this.Done = done;
		}
		get value(){
			return this.Value;
		}
		get done(){
			return this.Done;
		}
    }

    class Enumerator {
        constructor(data) {
            this.Data = data;
            this.Index = -1;
            this.Current = undefined;
            this.Done = false;
        }

        Next() {
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
    }

    class EnumeratorCollection {
        constructor() {
            this.Collection = [];
            this.Current = undefined;
            this.Done = false;
            this.Index = -1;
        }

        AddItem(item) {
            this.Collection.push( new Enumerator( [item] ) );
        }

        AddItems(items) {
            let enumerable = ParseDataAsEnumerable(items);
            let enumerator = enumerable.GetEnumerator();
            this.Collection.push( enumerator );
        }

        Next() {
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
            const next = enumerator.Next();
            if(next.Value === undefined){
                this.Index++;
                return this.Next();
            }
            this.Current = next.Value;
            this.Done = next.Done;
            return next;
        }
    }

    class LazyEnumerator {
        constructor(data) {
            this.Data = data.Data;
            this.Enumerable = data.Clone();
            this.Index = -1;
            this.Current = undefined;
            this.Done = false;
        }

        Next() {
            if (this.Index === -1) {
                this.Data = this.Enumerable.ForEachActionStack[this.Enumerable.ForEachActionStack.length - 1].Execute(this.Data);
            }
            if (this.Index >= this.Data.length) {
                ResetPredicates(this.Enumerable.Predicates);
                return new EnumeratorItem(undefined, true);
            }
            let item = undefined;
            while (item === undefined) {
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
                    if (item === undefined) {
                        break;
                    }
                }
                if (item === undefined) {
                    continue;
                }
                let done = this.Index >= this.Data.length;
                this.Done = done;
                this.Current = item;
                return new EnumeratorItem(item, done);
            }
        }
    }

    class IteratorEnumerator {
        constructor(iterator) {
            this.Iterator = iterator;
            this.Index = -1;
            this.Current = undefined;
            this.Done = false;
        }

        Next() {
            if (this.Done === true) {
                return new EnumeratorItem(this.Current, this.Done);
            }
            let next = this.Iterator.next();
            this.Done = next.done;
            this.Current = next.value;
            return new EnumeratorItem(this.Current, this.Done);
        }
    }

    class MapEnumerator {
        constructor(source) {
            this.Data = source;
            this.Index = -1;
            this.Current = undefined;
            this.Done = false;
            this.KeyIterator;
        }

        Next() {
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
    }

    class MemoizeFunc {
        constructor(func) {
            this.Func = func;
            this.Cache = new Map();
        }

        Call() {
            let args = CloneArray(arguments);
            let currentLevel = this.Cache;
            
            // Iterate thru arguments
            for(let i = 0; i < args.length; i++){
                let arg = args[i];
				if(arg instanceof Object){
					arg = JSON.stringify(arg);
				}
                // Already cached this, fetch and continue
                if(currentLevel.has(arg)){
                    currentLevel = currentLevel.get(arg);
                } else {
                    // Not cached, and last level. Calculate the final value to cache
                    if(i >= args.length - 1){
						let callingArgs = CloneArray(args);
						callingArgs.push(this);
                        let val = this.Func(...callingArgs);
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
    }

    class MemoizeFuncAsync {
        constructor(func, callBack) {
            this.Func = func;
            this.Cache = new Map();	
            this.Callback = callBack;
        }

        SetCache(args, value) {
            let currentLevel = this.Cache;
            for(let i = 0; i < args.length; i++){
                let arg = args[i];
				if(arg instanceof Object){
					arg = JSON.stringify(arg);
				}
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

        async Call() {
            let args = CloneArray(arguments);
            let currentLevel = this.Cache;
            let arg = null;
			let scope = this;
            // Iterate thru arguments
            for(let i = 0; i < args.length; i++){
                arg = args[i];
				if(arg instanceof Object){
					arg = JSON.stringify(arg);
				}
                // Already cached this, fetch and continue
                if(currentLevel.has(arg)){
                    currentLevel = currentLevel.get(arg);
					// Completely cached, return from cache
					if(i == args.length -1){
						scope.Callback(currentLevel);
						return currentLevel;
					}
                } else {
                    // Not cached, and last level. Calculate the final value to cache
                    if(i >= args.length - 1){
						return new Promise( (resolve,reject) => {
							this.Func.call(this,...args).then( v => {
								scope.SetCache(args,v);
								resolve(v);
								scope.Callback(v);
							});
						});
                    } else {
                        // Not cached, but not at last level. Set this to a new Mapping
                        currentLevel.set(arg, new Map());
                        currentLevel = currentLevel.get(arg);
                    }
                }
            }
			return currentLevel;
        }
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
		let arr = CloneArray(data);
		if(arr.length == data.length){
			return arr;
		}
		if(typeof data === "object"){
		   let d = [];
		   for(let key in data){
		   if(!data.hasOwnProperty(key)){
		      continue;
		   }
		      let kvp = new KeyValuePair(key,data[key]);
			  d.push(kvp);
		   }
		   return d;
		}
        return arr;
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
		let arr = CloneArray(data);
		if(arr.length == data.length){
		    return new Enumerable({
				Data: arr
			});	
		}
		if(typeof data === "object"){
		   let dict = new Dictionary();
		   for(let key in data){
		      if(!data.hasOwnProperty(key)){
			     continue;
			  }
			  dict.Add(key,data[key]);
		   }
		   return dict;
		}
        return new Enumerable({
            Data: arr
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
        for (let pred of Predicates) {
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
                item = Predicates[j].Execute(item, i, len);
                if (item === undefined) {
                    break;
                }
            }
            if (item !== undefined) {
				idx++;
                arr[idx]=(item);
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
                if (item === undefined) {
                    break;
                }
            }
            if (item === undefined) {
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
    class PublicEnumerable {
        constructor(data) {
            let d = ParseDataAsArray(data);
            return new Enumerable({
                Data: d
            });
        }
		
        // Static methods for Enumerable
		static Arrayify(input){
			if(Array.isArray(input)){
				return input;
			}
			return [input];
		}
        //Modify Enumerable.prototype
        static Extend(extenderMethod) {
                extenderMethod(Enumerable.prototype);
            }
        // The preferred smart constructor

        static From(data) {
                return ParseDataAsEnumerable(data);
        }
		static CreateEnum(){
			return new Enum(...arguments);
		}
        // Public Static Methods

        static Range(start, count, step) {
            let arr = [];
            step = step || 1;
            let curr = start;
            for (let i = 0; i < count; i++) {
                arr.push(curr);
                curr = curr + step;
            }
            return PublicEnumerable.From(arr);
        }

        static RangeTo(start, to, step) {
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

        static RangeDown(start, count, step=1) {
            return PublicEnumerable.Range(start, count, -step);
        }

        static Empty() {
            return PublicEnumerable.From([]);
        }

        static Sequence(cnt, generator, seed) {
            let arr = [];
            seed = seed || [];
            arr = seed.splice();
            let i = 0;
            while(arr.length != cnt){
                let newVal = generator(i,arr);
                if(newVal !== undefined){
                    arr.push(newVal);
                }
                i++;
            }
            return ParseDataAsEnumerable(arr);
        }

        static Until(generator, seed) {
            let arr = [];
            seed = seed || [];
            arr = ParseDataAsArray(seed);
            let i = 0;
            while(true){
                let newVal = generator(i,arr);
                if(newVal !== undefined){
                    arr.push(newVal);
                } else {
                    return ParseDataAsEnumerable(arr);				
                }
                i++;
            }
        }

        static Combinations(data, subsetSize) {
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

        static Permutations(elms, size) {
           let rtn = [];
           function PermuteHelper(currentElms,currentSet){
               if(currentSet.length === size){
                   rtn.push(currentSet.slice());
                   return;
               }
               for(let i = 0; i < currentElms.length; i++){
                   let item = currentElms.splice(i,1)[0];
                   currentSet.push(item);
                   PermuteHelper(currentElms,currentSet);
                   currentElms.splice(i,0,item);
                   currentSet.pop();
                   
               }
           }
           PermuteHelper(ParseDataAsArray(elms),[]);
           return ParseDataAsEnumerable(rtn).Select(x=>ParseDataAsEnumerable(x));
        }

        static Inherit(object, dataGetter, addIterator = true) {
            let p = object.prototype;
			let propertyNames = Object.getOwnPropertyNames(Enumerable.prototype);
                for (let prop of propertyNames) {

                    if (typeof Enumerable.prototype[prop] !== "function") {
                        continue;
                    }
					if(prop == "toString" || prop == "toJSON"){
						continue;
					}
                    let val = function(a,b,c,d,e,f,g,h,i,j,k,l) {
                        let enumerable = new Enumerable({Data: dataGetter(this)});
                        if(arguments.length > 12){
                            return enumerable[prop](...arguments);
                        }
                        return enumerable[prop](a,b,c,d,e,f,g,h,i,j,k,l);
                    }
					Object.defineProperty(p, prop, {value: val, enumerable: false });
                }
                if(addIterator){
                    object.prototype[Symbol.iterator] = function() {
                        let enumerator = this.GetEnumerator();
                        return {
                            next: () => {
                                return enumerator.Next();
                            }
                        };
                    }
                }
            }

        static ExtendArrays() {
            let p = Array.prototype;
			let propertyNames = Object.getOwnPropertyNames(Enumerable.prototype);
                for (let prop of propertyNames) {

                    if (typeof Enumerable.prototype[prop] !== "function") {
                        continue;
                    }
					if(prop == "constructor" || prop == "toJSON"){
						continue;
					}
                    
                    let val = function() {
                        let enumerable = new Enumerable({Data: this});
                        return enumerable[prop].apply(enumerable,arguments);
                    }
					Object.defineProperty(p, prop, {value: val, enumerable: false });
                }	
				_extendedObjects["Array"] = p;
        }
		
        static ExtendArrayLikes() {
            for(let key of Object.getOwnPropertyNames(window)){
                if(key == "Array"){ continue; }
                if(key == "_" || key.includes("Enumerable")){ 
                    continue; 
                }
                let thing = window[key];
                if(!thing || thing.prototype == null){continue;}
                let o = Object.create(thing.prototype);
                let isArrayLike = (Symbol.iterator in Object(o));
                if(isArrayLike){
                    _.Inherit(thing,x=>CloneArray(x),false);
					_extendedObjects[key] = thing.prototype;
                }
            }
        }

        static NoConflict() {
			if(window === undefined){
				return;
			}
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
		static get ExtendedObjects(){
			return _extendedObjects;
		}
    }
	
	function DeepFreeze(obj) {
		  // Retrieve the property names defined on obj
		  let propNames = Object.getOwnPropertyNames(obj);

		  // Freeze properties before freezing self
		  propNames.forEach(function(name) {
			let prop = obj[name];

			// Freeze prop if it is an object
			if (typeof prop == 'object' && prop !== null)
			  DeepFreeze(prop);
		  });

		  // Freeze self (no-op if already frozen)
		  return Object.freeze(obj);
	}	
	let _extendedObjects = {};

    // The private constructor. Define EVERYTHING in here
    class Enumerable {
        constructor(privateData) {
            let scope = this;

            // Private variables for module
            if (privateData.Predicates) {
                scope.Predicates = privateData.Predicates.slice();
				scope.Data = privateData.Data;
            } else {
				scope.Predicates = [];
				scope.Data = privateData.Data.slice();
			}
			
            if (privateData.ForEachActionStack) {
                scope.ForEachActionStack = privateData.ForEachActionStack.slice();
            } else {
				 scope.ForEachActionStack = [DEFAULTFOREACHACTIONPREDICATE];
			}
            if (privateData.NewForEachAction) {
                scope.AddToForEachStack(privateData.NewForEachAction);
            }
            if (privateData.NewPredicate) {
                scope.AddToPredicateStack(privateData.NewPredicate);
            }
        }

		static Apply(privateData){
            let scope = this;

            // Private variables for module
		
            if (privateData.Predicates) {
                scope.Predicates = privateData.Predicates.slice();
				scope.Data = privateData.Data;
            } else {
				scope.Predicates = [];
				scope.Data = privateData.Data.slice();
			}
            if (privateData.ForEachActionStack) {
                scope.ForEachActionStack = privateData.ForEachActionStack.slice();
            } else {
				 scope.ForEachActionStack = [DEFAULTFOREACHACTIONPREDICATE];
			}
            if (privateData.NewForEachAction) {
                scope.AddToForEachStack(privateData.NewForEachAction);
            }
            if (privateData.NewPredicate) {
                scope.AddToPredicateStack(privateData.NewPredicate);
            }
		}
		// toString override
		toString(){
			return `[${this.ToString(",")}]`;
		}
		// JSON.stringify override
		toJSON(){
            return this.ToJSON();
		}
        AddToForEachStack(action) {
            let scope = this;
            scope.ForEachActionStack.push( new ForEachActionPredicate(scope,action) );
        }

        AddToPredicateStack(pred) {
            let scope = this;
            const cnt = scope.Predicates.length;
            scope.Predicates[cnt] = pred;
        }

        GetEnumerator() {
            return new LazyEnumerator(this);
        }

        IsInvalidItem(item) {
            return item == undefined;
        }

        ToEnumerable() {
            return this.Clone();
        }

        ToArray() {
			if(this.Predicates.length == 0 && this.ForEachActionStack.length == 1){
				return this.Data;
			}
			if(this.ForEachActionStack.length > 1){
				return ProcessPredicates(this.Predicates,this.ForEachActionStack[this.ForEachActionStack.length - 1].Execute(this.Data));
			}
			return ProcessPredicates(this.Predicates,this.Data)
        }
		Freeze(){
			let arr = this.ToArray();
			Object.freeze(arr);
			return arr;
		}
		DeepFreeze(){
			return DeepFreeze(this.ToArray())
		}

        Flush() {
            let arr = this.ToArray();
            return _.From(arr);
        }

        ToReadOnlyArray() {
            let scope = this;
            let arr = scope.ToArray();
            Object.freeze(arr);
            return arr;
        }

        ToDictionary(predKey, predVal) {
            let arr = this.ToArray();
            let rtn = new Dictionary();

            for (let item of arr) {
                let key = predKey(item);
                let val = predVal(item);
                rtn.Add(key, val);
            }

            return rtn;
        }

        ToLookup(predKey, predVal) {
            let arr = this.ToArray();
            let rtn = new Lookup();

            for (let item of arr) {
                let key = predKey(item);
                let val = predVal(item);
                rtn.Add(key, val);
            }

            return rtn;
        }

        ToJSON() {
			let arr = this.ToArray();
            return JSON.stringify(arr);
        }

        ToString(separator=",") {
            let arr = this.ToArray();
            let rtn = "";
            for(let i = 0; i < arr.length; i++){
                if(i > 0){
                    rtn += separator;
                }
                rtn += arr[i].toString();
            }
            return rtn;
        }

        Memoize() {
            let arr = this.ToArray();
            return ParseDataAsEnumerable(arr);
        }

        ForEach(action, closureObject) {
			if(this.ForEachActionStack.lengthg > 1){
				ProcessPredicatesNoReturn(this.Predicates,
				this.ForEachActionStack[this.ForEachActionStack.length - 1].Execute(this.Data),
				action, 
				closureObject);
			} else {
				ProcessPredicatesNoReturn(this.Predicates, this.Data, action, closureObject);
            }
        }

        MemoEach(cache, action) {
            let memo = new MemoizeFunc(cache);
            action = action || function memoEachDoNothing(){};
            this.ForEach((i, v) => {
                let val = memo.Call(v);
                action(val);
            });
        }
	
        Where(pred) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewPredicate = new WherePredicate(pred);
            return new Enumerable(data);
        }

        Select(pred) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewPredicate = new SelectPredicate(pred);
            return new Enumerable(data);
        }

        SelectMany(pred, selectPred) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
                let sPred = new SelectPredicate(pred);
                let rtn = [];

                for (let item of arr) {
                    let selected = sPred.Execute(item);
                    selected = ParseDataAsArray(selected);

                    for (let jItem of selected) {
                        let converted = selectPred(item, jItem);
                        rtn.push(converted);
                    }
                }

                return rtn;
            }
            return new Enumerable(data);
        }

        Distinct(pred) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            let distinctHash = [];
            data.NewPredicate = new DistinctPredicate(pred);
            return new Enumerable(data);
        }
        Duplicate(pred) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
                let set = new Set();
				let dupesSet = new Set();
                for (let item of arr) {
					let i = item;
					if(pred){
						i = pred(item);
					}
					if(set.has(i)){
						dupesSet.add(i);
					}
					set.add(i);
                }

                return CloneArray(dupesSet);
            }
            return new Enumerable(data);
        }
        Skip(cnt) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewPredicate = new SkipPredicate(cnt);
            return new Enumerable(data);
        }

        SkipWhile(pred) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewPredicate = new SkipWhilePredicate(pred);
            return new Enumerable(data);
        }

        Take(cnt) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewPredicate = new TakePredicate(cnt);
            return new Enumerable(data);
        }

        TakeWhile(pred) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewPredicate = new TakeWhilePredicate(pred);
            return new Enumerable(data);
        }

        TakeExceptLast(cnt) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            cnt = cnt || 1;
            data.NewForEachAction = arr => {
                let newArr = [];
                let take = arr.length - cnt;
                for (let i = 0; i < take; i++) {
                    newArr.push(arr[i]);
                }
                return newArr;
            }
            return new Enumerable(data);
        }

        TakeLast(cnt) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
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

        TakeLastWhile(pred) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
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

        First(pred) {
			
            for(let item of this.ToArray()){
				if(pred == null){
					return item;
				}
				if(pred(item)){
					return item;
				}
			}
        }

        Single(pred) {
            let scope = this;
            return scope.First(pred);
        }

        Last(pred) {
            let scope = this;
            let p = new LastPredicate(pred);
            return p.Execute(scope).Last;
        }

        IndexOf(item) {
            let scope = this;
            let pred = x => x === item
            let p = new FirstPredicate(pred);
            return p.Execute(scope).Index;
        }

        LastIndexOf(item) {
            let scope = this;
            let arr = scope.ToArray();
            return arr.lastIndexOf(item);
        }

        OrderBy(pred) {
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

        OrderByDescending(pred) {
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

        Any(pred) {
            let scope = this;
            let first = scope.First(pred);
            return first !== undefined;
        }

        All(pred) {
            let scope = this;
            if (pred == null) {
                return true;
            }
            let p = new AllPredicate(pred);
            return p.Execute(scope);
        }

        Not(pred) {
            let scope = this;
            return scope.Where(x => !pred(x));
        }

        Union(items, pred, pred2) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
                let p = new UnionPredicate(items, pred, pred2);
                return p.Execute(arr);
            }
            return new Enumerable(data);
        }

        Intersect(items, pred, pred2) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
                let p = new IntersectPredicate(items, pred, pred2);
                return p.Execute(arr);
            }
            return new Enumerable(data);
        }

        Disjoint(items, pred, pred2) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
                let p = new DisjointPredicate(items, pred, pred2);
                return p.Execute(arr);
            }
            return new Enumerable(data);
        }

        Contains(item) {
            let scope = this;
            return scope.IndexOf(item) > -1;
        }

        ContainsSequence(sequence) {
            let scope = this;
            let cnt = 0;
            let pred = item => {
                cnt++;
                if(cnt > 0){
                    return false;
                }
                return true;
            }
            scope.SplitBy(sequence).ForEach(pred);
            return cnt > 0;
        }

        Except(items, pred, pred2) {
            let scope = this;
            pred = pred || (x => x)
            pred2 = pred2 || (x => x)
            let dataToPass = CreateDataForNewEnumerable(scope);

            // Uses hashing algorithm
            dataToPass.NewForEachAction = arr => {
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

        In(items, pred, pred2) {
            let scope = this;
            pred = pred || (x => x)
            pred2 = pred2 || (x => x)
            let dataToPass = CreateDataForNewEnumerable(scope);

            // Uses hashing algorithm
            dataToPass.NewForEachAction = arr => {
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

        Concat(items) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
                let itemArr = ParseDataAsArray(items);
                let rtn = arr.concat(itemArr);
                return rtn;
            }
            return new Enumerable(data);
        }

        Slice(a, b) {
            if(a === undefined){
                a = 0;
            }	
            if( b === undefined){
                b = POSITIVE_INFINITY;
            }
            return this.Skip(a).Take(b-a);
        }

        Prepend(items) {
            return ParseDataAsEnumerable(items).Concat(this);
        }

        Zip(items, pred) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
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

        ZipUneven(items, pred) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
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

        Reverse() {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
                let rtn = [];
                for (let i = arr.length - 1; i > -1; i--) {
                    rtn.push(arr[i]);
                }
                return rtn;
            }
            return new Enumerable(data);
        }

        Split(pred, includeSplitter) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewPredicate = new SplitPredicate(pred, includeSplitter);
            return new Enumerable(data);
        }

        SplitBy(sequence, pred, includeSplitter) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewPredicate = new SplitByPredicate(sequence, pred, includeSplitter);
            return new Enumerable(data);
        }

        Batch(cnt) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewPredicate = new BatchPredicate(cnt);
            return new Enumerable(data);		
        }

        BatchAccumulate(size) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
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

        GroupBy(pred) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.GroupingPredicate = pred;
            return new GroupedEnumerable(data);
        }

        Join(data, joinKeysLeft, joinKeysRight, selectPred) {
            let scope = this;
            let dataToPass = CreateDataForNewEnumerable(scope);

            // Uses hash join algorithm
            dataToPass.NewForEachAction = arr => {
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

                        for (let left of group) {
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

        LeftJoin(data, joinKeysLeft, joinKeysRight, selectPred) {
            let scope = this;
            let dataToPass = CreateDataForNewEnumerable(scope);

            // Uses hash join algorithm
            dataToPass.NewForEachAction = arr => {
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

                        for (let right of group) {
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

        RightJoin(data, joinKeysLeft, joinKeysRight, selectPred) {
            let scope = this;
            let dataToPass = CreateDataForNewEnumerable(scope);

            // Uses hash join algorithm
            dataToPass.NewForEachAction = arr => {
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

                        for (let left of group) {
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

        FullJoin(data, joinKeysLeft, joinKeysRight, selectPred) {
            let scope = this;
            let dataToPass = CreateDataForNewEnumerable(scope);

            // Uses hash join algorithm
            dataToPass.NewForEachAction = arr => {
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

                        for (let right of group) {
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

        Count(pred) {
            let scope = this;
            if (pred !== undefined) {
                return scope.Where(x => pred(x)).ToArray().length;
            }
            return scope.ToArray().length;
        }

        IsEmpty() {
            let scope = this;
            for (let obj of scope) {
                return false;
            }
            return true;
        }
        Statistics(pred){
			let rtn = {
				Count: this.Count(pred),
				Average: this.Average(pred),
				StdDev: this.StdDev(pred),
				Variance: this.Variance(pred),
				Range: this.Range(pred),
				First: this.First(pred),
				Last: this.Last(pred),
				Median: this.Median(pred),
				Mode: this.Mode(pred),
				Sum: this.Sum(pred),
				Product: this.Product(pred),
				RangeBy: this.RangeBy(pred)
			}
			rtn.Mode = rtn.Mode.ToArray();
			rtn.RangeBy.Min = rtn.RangeBy.Min.ToArray();
			rtn.RangeBy.Max = rtn.RangeBy.Max.ToArray();
			
			return rtn;
			
		}
        Average(pred) {
            let scope = this;
            let arr = scope.ToArray();
            let sum = 0;

            for (let item of arr) {
                if (pred) {
                    sum += pred(item);
                } else {
                    sum += item;
                }
            }

            return sum / arr.length;
        }

        Variance(pred) {
            let scope = this.ToEnumerable();
            let avg = scope.Average(pred);
            let cnt = scope.Count();
            if (pred !== undefined) {
                return scope.Sum(x => {
                    let val = pred(x) - avg;
                    return (val * val);
                }) / cnt;
            }
            return scope.Sum(x => {
                let val = x - avg;
                return (val * val);
            }) / cnt;
        }

        StdDev(pred) {
            let scope = this;
            let v = scope.Variance(pred);
            return Math.sqrt(v);
        }

        Median(pred) {
            let scope = this;
            let values = [];
            if (pred) {
                values = scope.Select(pred).ToArray();
            } else {
                values = scope.ToArray();
            }
            values.sort((a, b) => a - b);
            let half = Math.floor(values.length / 2);
            if (values.length % 2) {
                return values[half];
            } else {
                return (values[half - 1] + values[half]) / 2.0;
            }
        }

        Mode(pred, level) {
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

        Sum(pred) {
            let scope = this;
            let arr = scope.ToArray();
            let sum = 0;

            for (let item of arr) {
                if (pred) {
                    sum += pred(item);
                } else {
                    sum += item;
                }
            }

            return sum;
        }

        Product(pred) {
            let scope = this;
            let arr = scope.ToArray();
            let prod = 1;

            for (let item of arr) {
                if (pred) {
                    prod *= pred(item);
                } else {
                    prod *= item;
                }
            }

            return prod;
        }

        Optimize(optimizers) {
            let data = this.ToArray();
            let optClone = _.From(optimizers).ToArray();
            for(let item of optClone){
                if(item.OptimizeOption == Enumerable.Enums.OptimizeOptions.Min){
                    item.CompareValue = Number.POSITIVE_INFINITY;
                }
				else if(item.OptimizeOption == Enumerable.Enums.OptimizeOptions.Max){
                    item.CompareValue = Number.NEGATIVE_INFINITY;
                }
				else if(item.OptimizeOption == Enumerable.Enums.OptimizeOptions.SumMin){
					item.CompareValue = Number.POSITIVE_INFINITY;
					item.Sum = 0;
				}
				else if(item.OptimizeOption == Enumerable.Enums.OptimizeOptions.SumMax){
	                item.CompareValue = Number.NEGATIVE_INFINITY;	
					item.Sum = 0;
				}
				if(item.Predicate == null){
					item.Predicate = Enumerable.Functions.Identity;
				}
            }
            for(let item of data){
                for(let opt of optClone){
                    let pVal = opt.Predicate(item);
                    if(opt.OptimizeOption == Enumerable.Enums.OptimizeOptions.Min){
                        if(pVal < opt.CompareValue){
                            opt.CompareValue = pVal;
                        }
                    } 
					else if(opt.OptimizeOption == Enumerable.Enums.OptimizeOptions.Max){
                        if(pVal > opt.CompareValue){
                            opt.CompareValue = pVal;
                        }
                    }
					else if(opt.OptimizeOption == Enumerable.Enums.OptimizeOptions.SumMin){
						opt.Sum += pVal;
						if(opt.Sum < opt.CompareValue){
							opt.CompareValue = opt.Sum;
						}
					}
					else if(opt.OptimizeOption == Enumerable.Enums.OptimizeOptions.SumMax){
						opt.Sum += pVal;
						if(opt.Sum > opt.CompareValue){
							opt.CompareValue = opt.Sum;
						}						
					}
					else if(opt.OptimizeOption == Enumerable.Enums.OptimizeOptions.Custom){
						opt.Evaluate(pVal);
					}
					
                }
            }
            return _.From(optClone).Select(x=>x.CompareValue).ToArray();
        }

        Max(pred, level) {
            let scope = this;
            let maxPred = new MaxPredicate(pred, level);
            return maxPred.Max(scope);
        }

        MaxBy(pred, level) {
            let scope = this;
            let maxPred = new MaxPredicate(pred, level);
            return maxPred.MaxBy(scope);
        }

        Min(pred, level) {
            let scope = this;
            let minPred = new MinPredicate(pred, level);
            return minPred.Min(scope);
        }

        MinBy(pred, level) {
            let scope = this;
            let minPred = new MinPredicate(pred, level);
            return minPred.MinBy(scope);
        }

        Range(pred, level) {
            let scope = this;
            let minPred = new MinPredicate(pred, level);
            let maxPred = new MaxPredicate(pred, level);
            return new Range(minPred.Min(scope), maxPred.Max(scope));
        }

        RangeBy(pred, level) {
            let scope = this;
            let minPred = new MinPredicate(pred, level);
            let maxPred = new MaxPredicate(pred, level);
            return new Range(minPred.MinBy(scope), maxPred.MaxBy(scope));
        }

        Aggregate(pred, seed) {
            let scope = this;
            let curr = null;
            if(seed !== undefined){
                curr = seed;
            }
            let arr = scope.ToArray();

            for (let item of arr) {
                if (curr === null) {
                    curr = item;
                    continue;
                }
                let val = item;
                curr = pred(curr, val);
            }

            return curr;
        }

        AggregateRight(pred, seed) {
           return this.Reverse().Aggregate(pred,seed);	
        }

        OfType(type) {
            let scope = this;
            return scope.Where(x => (typeof x) === type);
        }

        OfInstance(type) {
            let scope = this;
            return scope.Where(x => x instanceof type);
        }

        Remove(item) {
            return this.RemoveRange([item]);
        }
		Fill(value,start,end){
            let scope = this;
            let dataToPass = CreateDataForNewEnumerable(scope);

            dataToPass.NewForEachAction = arr => {
                return arr.fill(value,start,end);
            }
            return new Enumerable(dataToPass);
		}
        RemoveAt(idx, cnt) {
            let scope = this;
            let dataToPass = CreateDataForNewEnumerable(scope);
            dataToPass.NewPredicate = new RemoveAtPredicate(idx,cnt);
            return new Enumerable(dataToPass);
        }

        RemoveRange(items) {
            let scope = this;
            let dataToPass = CreateDataForNewEnumerable(scope);	
            dataToPass.NewPredicate = new RemovePredicate(items);
            return new Enumerable(dataToPass);	
        }

        InsertRange(idx, data) {
            let scope = this;
            let dataToPass = CreateDataForNewEnumerable(scope);

            dataToPass.NewForEachAction = arr => {
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

        InsertAt(idx, data) {
            let scope = this;
            return scope.InsertRange(idx, [data]);
        }

        InsertWhere(item, pred) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
                for(let i = 0; i < arr.length; i++){
                    let o = arr[i];
                    if(pred(o) === true){
                        i++;
                        arr.splice(i,0,item);
                    }
                }
                return arr;
            }
            return new Enumerable(data);
        }

        InsertRangeAt(idx, data) {
            let scope = this;
            let dataToPass = CreateDataForNewEnumerable(scope);
            dataToPass.NewForEachAction = arr => {
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

        Choice(cnt) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
                let rtn = [];
                for (let i = 0; i < cnt; i++) {
                    let idx = Math.floor(arr.length * Math.random());
                    rtn.push(arr[idx]);
                }
                return rtn;
            }
            return new Enumerable(data);
        }

        Cycle(cnt) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
                let rtn = [];
                for (let i = 0; i < cnt; i++) {
                    let idx = i % arr.length;
                    rtn.push(arr[idx]);
                }
                return rtn;
            }
            return new Enumerable(data);
        }

        Repeat(elm, cnt) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
                let rtn = arr.slice();
                for (let i = 0; i < cnt; i++) {
                    rtn.push(elm);
                }
                return rtn;
            }
            return new Enumerable(data);
        }

        ElementAt(idx) {
            let scope = this;
            let arr = scope.ToArray();
            return arr[idx];
        }

        RandomElement(count=1) {
            let scope = this;
            let arr = scope.ToArray();
            if(count == 1){
                let idx = Math.floor(Math.random()*arr.length);
                return arr[idx];
            }
            let rtn = [];
            for(let i = 0; i < count; i++){
                rtn[i] = arr[Math.floor(Math.random()*arr.length)];
            }
            return rtn;
        }

        Push(elm) {
            let scope = this;
            let fea = scope.ForEachActionStack[scope.ForEachActionStack.length-1];
            if(fea instanceof PushPredicate){
                fea.Elms.push(elm);
                return this;
            }
            scope.ForEachActionStack.push( new PushPredicate(scope,elm) );
            return this;
        }

        Pop() {
            let scope = this;
            let fea = scope.ForEachActionStack[scope.ForEachActionStack.length-1];
            if(fea instanceof PopPredicate){
                fea.PopCount++;
                return this;
            }
            scope.ForEachActionStack.push( new PopPredicate(scope) );
            return this;
        }

        Shuffle() {
            let scope = this;
            return scope.OrderBy(Enumerable.Functions.ShuffleSort);
        }

        Scan(seed, generator) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => {
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

        Catch(handler) {
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

        Trace(msg) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            let oldPredicate = data.Predicate;
            data.NewPredicate = new TracePredicate(msg);
            return new Enumerable(data);
        }

        Write(symbol, pred) {
            let scope = this;
            if(symbol == null || symbol == undefined){
                symbol = "";
            }
            let rtn = "";
			let addSymbol = false;
			for(let item of this){
				if(addSymbol){
					rtn += symbol;
				}
				if(pred){
					item = pred(item);
				}
				rtn += item;
				addSymbol = true;
			}
            return rtn;
        }

        WriteLine(pred) {
            let scope = this;
            return scope.Write("\r\n", pred);
        }

        Clone() {
            let scope = this;
            let privData = CreateDataForNewEnumerable(scope);
            return new Enumerable(privData)
        }

        SequenceEqual(other, comparer) {
            let scope = this;
            const a1 = scope.ToArray();
            const a2 = ParseDataAsArray(other);
            if (a1.length !== a2.length) {
                return false;
            }

			let i = 0;
            for (let itemA of a1) {
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
				i++;
            }

            return true;
        }

        SequenceEqualUnordered(other, keyLeft, keyRight) {
            let scope = this;
            const a1 = scope.ToArray();
            const a2 = ParseDataAsArray(other);
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

        Sequence(cnt, seed, generator) {
            let scope = this;
            let data = {
                Data: scope.Data,
                Predicates: scope.Predicates,
                ForEachActionStack: scope.ForEachActionStack
            };
            data.NewForEachAction = arr => {
                let rtn = arr;
                let newEnum = PublicEnumerable.Sequence(cnt, seed, generator).ToArray();
                return rtn.concat(newEnum);
            }
            return new Enumerable(data);
        }

        Profile(callBack) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.NewForEachAction = arr => arr
            let rtn = new Enumerable(data);		
            
            let fe = rtn.ForEachActionStack[rtn.ForEachActionStack.length-1];
            let oldEx = fe.Execute;
            let newEx = function profileForEachActionExecute(arr){
                let profile = Enumerable.Functions.Profile(oldEx,fe,[arr]);
                callBack(profile.Time);
                return profile.Data;
            }
            fe.Execute = newEx;

            return rtn;		
        }

        AsyncParallel(interval) {
            return new AsyncParallel(this, interval);
        }

        AsyncSequential() {
            return new AsyncSequential(this);
        }
		async ParallelEach(action){
			return PublicEnumerable.Parallel.ForEach(this,action);
		}
    }



    let DefaultForEachActionPredicate = function(){
		this.Action = arr => arr
		this.Execute = function(arr){
			return this.Action(arr);
		}
	}

    let DEFAULTFOREACHACTIONPREDICATE = new DefaultForEachActionPredicate();

    let ForEachActionPredicate = function(scope, action){
		this.OldForEachActionPredicate = scope.ForEachActionStack[scope.ForEachActionStack.length - 1];

		this.OldPredicates = scope.Predicates.slice();
		scope.Predicates = [];
		this.Action = action;
		this.Execute = function(arr){	
			return this.Action(
				ProcessPredicates(this.OldPredicates,
					this.OldForEachActionPredicate.Execute(arr)
				)
			)
		}
	}
    Enumerable.prototype[Symbol.iterator] = function() {
        let enumerator = this.GetEnumerator();
        return {
            next: () => {
                return enumerator.Next();
            }
        };
    }

    class WherePredicate {
        constructor(pred) {
            //super(arguments);
            this.Predicate = pred;

        }
		Reconstruct(){
			return new WherePredicate(this.Predicate);
		}
        Execute(item, i) {
            return this.Predicate(item, i) ? item : undefined;
        }

        Reset() {}
    }

    class SelectPredicate {
        constructor(pred) {
           // super(arguments);
            this.Predicate = pred;
        }
		Reconstruct(){
			return new SelectPredicate(this.Predicate);
		}
        Execute(item, i) {
            return this.Predicate(item, i)
        }

        Reset() {}
    }

    class DistinctPredicate {
        constructor(pred) {
            //super(arguments);
			this._pred = pred;
            this.Hash = new HashMap(pred);
        }
		Reconstruct(){
			return new DistinctPredicate(this._pred);
		}
        Predicate(item) {
            // returns undefined in failed, otherwise returns the item
            let result = this.Hash.TryAdd(item);
            if(result !== undefined){
                return item;
            }
        }

        Execute(item) {
            return this.Predicate(item)
        }

        Reset() {
            this.Hash.Clear();
        }
    }

    class SkipPredicate {
        constructor(cnt) {
            this.Skipped = 0;
            this.SkipCount = cnt;
        }
		Reconstruct(){
			return new SkipPredicate(this.SkipCount);
		}
        Predicate(item) {
                if (this.Skipped < this.SkipCount) {
                    this.Skipped++;
                    return undefined;
                }
                return item;
        }

        Execute(item) {
                return this.Predicate(item)
        }

        Reset() {
                this.Skipped = 0;
        }
    }

    class SkipWhilePredicate {
        constructor(pred) {
            this.CanSkip = true;
            this._predicate = pred;
        }
		Reconstruct(){
			return new SkipWhilePredicate(this._predicate);
		}
        Predicate(item) {
            if (!this.CanSkip) {
                return item;
            }
            this.CanSkip = pred(item);
            if (this.CanSkip) {
                return undefined;
            }
            return item;
        }

        Execute(item) {
            return this.Predicate(item)
        }

        Reset() {
            this.CanSkip = true;
        }
    }

    class TakePredicate {
        constructor(cnt) {
            this.Took = 0;
            this.TakeCount = cnt;
            this.CanTake = true;
        }
		Reconstruct(){
			return new TakePredicate(this.TakeCount);
		}
        Predicate(item) {
            if (this.Took >= this.TakeCount) {
                this.CanTake = false;
                return undefined;
            }
            this.Took++;
            return item;
        }

        Execute(item) {
            return this.Predicate(item)
        }

        Reset() {
            this.Took = 0;
            this.CanTake = true;
        }
    }

    class TakeWhilePredicate {
        constructor(pred) {
            this.CanTake = true;
            this._predicate = pred;
        }
		Reconstruct(){
			return new TakeWhilePredicate(this._predicate);
		}
        Predicate(item) {
            if (!this.CanTake) {
                return undefined;
            }
            this.CanTake = pred(item);
            if (!this.CanTake) {
                return undefined;
            }
            return item;
        }

        Execute(item) {
            return this.Predicate(item)
        }

        Reset() {
            this.CanTake = true;
        }
    }

    class FirstPredicate {
		constructor(pred){
			this._SCOPE = this;
			this._predicate = pred;
			this._first = null;
			this._firstIndex = -1;			
			if (this._predicate == null) {
				this.Predicate = this.NULL_PRED_METHOD.bind(this);
			} else {
				this.Predicate = this.PRED_METHOD.bind(this);
			}
		}
		Reconstruct(){
			return new FirstPredicate(this._predicate);
		}
		NULL_PRED_METHOD(i, v){
			this._SCOPE._first = v;
			return false;
		}
		PRED_METHOD(i, v){
			if (this._SCOPE._predicate(v)) {
				this._SCOPE._first = v;
				this._SCOPE._firstIndex = i;
				return false;
			}
		}
		Execute(SCOPE) {
			SCOPE.ForEach(this.Predicate);
			let idx = this._firstIndex;
			let first = this._first;
			return {
				Index: idx,
				First: first
			};
		}
		Reset() {
			this._first = null;
			this._firstIndex = -1;
		}
    }
    class LastPredicate {
		constructor(pred){
			this.Predicate = pred;
			this._last = null;
			this._lastIndex = -1;
		}
		Reconstruct(){
			return new LastPredicate(this.Predicate);
		}
        Execute(SCOPE) {
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
        Reset() {
            this._last = null;
            this._lastIndex = -1;
        }
    }

    class AllPredicate {
        constructor(pred) {
            this._predicate = pred;
            this._all = true;
        }
		Reconstruct(){
			return new AllPredicate(this._predicate);
		}
        Predicate(i, v) {
            if (this._predicate(v) === false) {
                this._all = false;
                return false;
            }
        }

        Execute(SCOPE) {
            SCOPE.ForEach(this.Predicate.bind(this));
            return this._all;
        }

        Reset() {
            this._all = true;
        }
    }

    class UnionPredicate {
        constructor(items, pred, pred2) {
            let scope = this;
            this.Items = items;
            this.Predicate = pred || (x => x)
            this.Predicate2 = pred2 || (x => x)
        }
		Reconstruct(){
			return new UnionPredicate(this.Items,this.Predicate,this.Predicate2);
		}
        Reset() {}

        Execute(arr) {
            let items = ParseDataAsArray(this.Items);
            let hash = new HashMap(this.Predicate);

            for (let item of arr) {
                hash.TryAdd(item);
            }

            let rtn = [];
            let hash2 = new HashMap(this.Predicate2);

            for (let item of items) {
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

    class IntersectPredicate {
        constructor(items, pred, pred2) {
            this.Items = items;
            this.Predicate = pred || (x => x)
            this.Predicate2 = pred2 || (x => x)
        }
		Reconstruct(){
			return new IntersectPredicate(this.Items,this.Predicate,this.Predicate2);
		}
        Reset() {}

        Execute(arr) {
            let rtn = [];
            let items = ParseDataAsArray(this.Items);
            let hash1 = new HashMap(this.Predicate);
            let hash2 = new HashMap(this.Predicate2);

            for (let item of arr) {
                hash1.TryAdd(item);
            }

            for (let item of items) {
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

    class DisjointPredicate {
        constructor(items, pred, pred2) {
            this.Items = items;
            this.Predicate = pred || (x => x)
            this.Predicate2 = pred2 || (x => x)
        }
		Reconstruct(){
			return new DisjointPredicate(this.Items,this.Predicate,this.Predicate2);
		}
        Reset() {}

        Execute(arr) {
            let setA = arr;
            let setB = ParseDataAsArray(items);
            let rtn = []
            let hash = new HashMap(this.Predicate);

            for (let item of setA) {
                hash.TryAdd(item);
            }

            for (let item of setB) {
                let val = this.Predicate2(item);
                if (hash.ContainsFromExtractedValue(val) === false) {
                    rtn.push(item);
                }
            }

            hash = new HashMap(this.Predicate2);

            for (let item of setB) {
                hash.TryAdd(item);
            }

            for (let item of setA) {
                let val = this.Predicate(item);
                if (hash.ContainsFromExtractedValue(val) === false) {
                    rtn.push(item);
                }
            }

            return rtn;
        }
    }

    class SplitPredicate {
        constructor(pred, includeSplitter) {
            this.Predicate = pred;
            this.IncludeSplitter = includeSplitter;
            this.CurrentGroup = [];
            this.NeedsFlush = false;
        }
		Reconstruct(){
			return new SplitPredicate(this.Predicate,this.IncludeSplitter);
		}
        Reset() {
            this.CurrentGroup = [];
            this.NeedsFlush = false;
        }

        Flush() {
            this.CurrentGroup = [];
            this.NeedsFlush = false;
        }

        Execute(item, i, len) {
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

    class SplitByPredicate {
        constructor(sequence, pred, includeSplitter) {
            this.Predicate = pred || this._defaultPred;
            this.IncludeSplitter = includeSplitter;
            this.CurrentGroup = [];
            this.CurrentSequence = [];
            this.Sequence = ParseDataAsArray(sequence);
            this.NeedsFlush = false;
        }
		Reconstruct(){
			return new SplitByPredicate(this.Sequence,this.Predicate,this.IncludeSplitter);
		}
		_defaultPred(a, b){
			return a === b
		}
        _concat(a, b) {
            for (let i = 0; i < b.length; i++) {
                a.push(b[i]);
            }
        }

        Reset() {
            this.CurrentGroup = [];
            this.NeedsFlush = false;
            this.CurrentSequence = [];
        }

        Flush() {
            this.CurrentGroup = [];
            this.NeedsFlush = false;
            this.CurrentSequence = [];
        }

        Execute(item, i, len) {
            if (this.NeedsFlush === true) {
                this.Flush();
            }
            this.CurrentSequence.push(item);
            let currentItem = this.Sequence[this.CurrentSequence.length - 1];
            let equal = this.Predicate(item, currentItem);

            if (equal === false) {
                this._concat(this.CurrentGroup, this.CurrentSequence);
                this.CurrentSequence = [];
            }

            if (equal === true) {
                if (this.CurrentSequence.length === this.Sequence.length) {
                    if (this.IncludeSplitter === true) {
                        this._concat(this.CurrentGroup, this.CurrentSequence);
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

    class BatchPredicate {
        constructor(cnt) {
            this.CurrentSequence = [];
            this.BatchSize = cnt;	
        }
		Reconstruct(){
			return new BatchPredicate(this.BatchSize);
		}
        Reset() {
            this.CurrentSequence = [];
        }

        Execute(item, i, len) {
            
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

    let MaxPredicate = function(pred, level) {
        BasePredicate.Apply.apply(this,arguments);
        this.Level = level || 0;
        this.Predicate = pred;
        this.MaxFirst = function(SCOPE) {
            let max = Number.NEGATIVE_INFINITY;
            let arr = SCOPE.ToArray();
            let pred = this.Predicate;

            for (let item of arr) {
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
                arr.sort((a, b) => {
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
    let MinPredicate = function(pred, level) {
        BasePredicate.Apply.apply(this,arguments);
        this.Level = level || 0;
        this.Predicate = pred;
        this.MinFirst = function(SCOPE) {
            let min = Number.POSITIVE_INFINITY;
            let arr = SCOPE.ToArray();
            let pred = this.Predicate;

            for (let item of arr) {
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
                arr.sort((a, b) => {
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

    class RemovePredicate {
        constructor(items) {
            this.Items = ParseDataAsEnumerable(items);
            this.ItemsToCheck;		
        }
		Reconstruct(){
			return new RemovePredicate(this.Items);
		}
        Reset() {
            this.Items = this.Items.Memoize();
            let arr = this.Items.ToArray();
            this.ItemsToCheck = new Map();

            for (let v of arr) {
                if(this.ItemsToCheck.has(v)){
                    this.ItemsToCheck.get(v).push(v);
                } else {
                    this.ItemsToCheck.set(v, [v]);
                }
            }
        }

        Execute(item, i, len) {
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
            return undefined;
        }
    }

    class RemoveAtPredicate {
        constructor(idx, cnt) {
            this.Index = idx;
            this.Count = cnt || 1;
            this.RemoveCount = 0;
            this.BeganRemove = false;      		
        }
		Reconstruct() {
			return new RemoveAtPredicate(this.Index,this.Count);
		}
        Reset() {
            this.RemoveCount = 0;
            this.BeganRemove = false;
        }

        Execute(item, i, len) {
            if(i === this.Index){
                this.BeganRemove = true;
            }
            if(this.BeganRemove === true){
                if(this.RemoveCount < this.Count){
                    this.RemoveCount++;
                    return undefined;
                }
            }
            return item;
        }
    }

    let PushPredicate = function(scope,elm){
        this.Elms = [elm];
		let that = this;
		ForEachActionPredicate.apply(this,[scope,arr => {
			let a = arr.slice();
			return a.concat(that.Elms);
		}]);
	}
    let PopPredicate = function(scope){
        this.PopCount = 1;
		let that = this;
		ForEachActionPredicate.apply(this,[scope,arr => arr.slice(0,Math.max(0,arr.length - that.PopCount))]);
	}

    class CatchPredicate {
        constructor(handler, refPred) {
            this.Handler = handler;
            this.HandledPredicate = refPred;
        }
		Reconstruct(){
			return new CatchPredicate(this.Handler,this.HandledPredicate);
		}
        Predicate(item) {
            try {
                return this.HandledPredicate.Execute(item);
            } catch (e) {
                this.Handler(e, item);
                return undefined;
            }
        }

        Reset() {}

        Execute(item) {
            return this.Predicate(item);
        }
    }

    class TracePredicate {
        constructor(msg) {
            this.Message = msg;
        }
		Reconstruct(){
			return new TracePredicate(this.Message);
		}
        Predicate(item) {
            console.log(this.Message, ":", item);
            return item;
        }

        Execute(item) {
            return this.Predicate(item);
        }

        Reset() {}
    }

    class AsyncParallel {
        constructor(enumerable) {
            this.Items = ParseDataAsEnumerable(enumerable);
        }

		 async ForEach(action){
			 let promises = [];
			 let idx = -1;
			 let scope = this;
			 for(let item of this.Items){
				idx++;
				let promise = action(idx,item);
				promises.push(promise);
			}
			return Promise.all(promises);
		 }
		async MemoEach(cache,action){
            let pending = new Map();
            let waitList = new Map();
            action = action || function memoEachAsyncDoNothing(){};
			let getKey = v => {
				if(v instanceof Object){
					return JSON.stringify(v);
				}
				return v;
			};
            let memo = new MemoizeFuncAsync(cache,action);

			/*
            // Cache was denied, fetch fresh value
            memo.Events.BindEvent("OnReject", (val, args) => {
                let v = args[0];
				let key = getKey(v);
                if(waitList.has(v)){
                    let wait = waitList.get(key);
                    let first = wait[0];
                    if(first !== undefined){
                        wait.splice(0,1);
                        if(wait.length === 0){
                            if(pending.has(key)){
                                pending.delete(key);
                            }	
                        }
                        memo.Call(first.value);
                        return;
                    }
                }
            });*/
			
            let rtn = this.ForEach((i,v) => {
				let key = getKey(v);
                if(pending.has(key) === true){
					waitList.get(key).push({index:i,value:v});
					return;
				}
				pending.set(key,true);
				waitList.set(key,[]);
				memo.Call(v).then(v2=>{
					let key = getKey(v2);
					if(waitList.has(key)){
						let wait = waitList.get(key);
						for(let waitItem of wait){
							action(waitItem.value);
						}
						waitList.delete(key);
					}
					if(pending.has(key)){
						pending.delete(key);
					}						
				});
            });	
			return rtn;
		}
    }

    class AsyncSequential {
        constructor(enumerable) {
            this.Items = ParseDataAsEnumerable(enumerable);		
        }

		 async ForEach(action){
			 let idx = -1;
			 let scope = this;
			for(let item of this.Items){
				idx++;
				await action(idx,item);
			}
		 }
		async MemoEach(cache,action){
			let scope = this;
			let memo = new MemoizeFuncAsync(cache,action);
			
			let rtn = this.ForEach( (i,v) => {
				return memo.Call(v);
			});
			return rtn;
		}
    }

    let OrderPredicate = function(pred, desc) {
        this.SortFunctions = [];
        let scope = this;
        this.SortComparer = null;
        this.Composite = function(newPred, newDesc) {
            if (this.SortComparer === null) {
                if (desc) {
                    this.SortComparer = (a, b) => {
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
                    this.SortComparer = (a, b) => {
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
                this.SortComparer = (a, b) => {
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
                this.SortComparer = (a, b) => {
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
        this.Execute = array => array.sort(scope.SortComparer);
        this.Composite(pred, desc);
    };

    class OrderedEnumerable extends Enumerable{
		constructor(privateData){
			let argsToApply = {
				Data: privateData.Data,
				ForEachActionStack: privateData.ForEachActionStack,
				Predicates: privateData.Predicates,
			};
			super(argsToApply);
			this.SortingPredicate = new OrderPredicate(privateData.SortComparer, privateData.Descending);
			let scope = this;
			this.AddToForEachStack(arr => {
				scope.SortingPredicate.Execute(arr);
				return arr;
			});
		}
		ThenByDescending(pred) {
			this.SortingPredicate.Composite(pred, true);
			return this;
		}
		ThenBy(pred) {
			this.SortingPredicate.Composite(pred, false);
			return this;
		}
    }

    class GroupedEnumerable extends Enumerable{
		constructor(privateData){
			const argsToApply = {
				Data: privateData.Data,
				ForEachActionStack: privateData.ForEachActionStack,
				Predicates: privateData.Predicates
			};
			super(argsToApply);
			let scope = this;
			// Private variables for module
			this.GroupingPredicates = privateData.GroupingPredicate;
			this.AddToForEachStack(scope.GroupingFunc.bind(scope));
		}
		GroupingFunc(arr){
			if (arr.length === 0) {
				return arr;
			}
			const GroupingPredicates = this.GroupingPredicates;
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
    }

    class FilteredEnumerable extends Enumerable{
		constructor(privateData){
        let argsToApply = {
            Data: privateData.Data,
            ForEachActionStack: privateData.ForEachActionStack,
            Predicates: privateData.Predicates
        };
		super(argsToApply);
        this.AddToPredicateStack(privateData.WherePredicate);
		}
    }

    class Dictionary extends Enumerable{
        constructor() {
			super([]);
            this._map = new Map();
        }
        get Data() {
            return this.ToArray();
        }

        set Data(v) {

        }

        get Keys() {
            let rtn = CloneArray(this._map.keys());
            return ParseDataAsEnumerable(rtn);
        }

        get Values() {
            let rtn = CloneArray(this._map.values());
            return ParseDataAsEnumerable(rtn);
        }

        ForEach(action) {
            let scope = this;
            let keys = scope.Keys.ToArray();
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

        ContainsKey(key) {
            return this._map.has(key);
        }

        ContainsValue(val) {
            let scope = this;
            let result = false;
            scope.ForEach((i, kvp) => {
                if (kvp.Value === val) {
                    result = true;
                    return false;
                }
            });
            return result;
        }

        Get(key) {
            let scope = this;
            if (scope._map.has(key) === false) {
                throw new Error(`Dictionary does not contain the given key: ${key}`);
            }
            return scope._map.get(key);
        }

        Set(key, value) {
            let scope = this;
            scope._map.set(key, value);
        }

        Add(key, value) {
            let scope = this;
            if (scope._map.has(key)) {
                throw new Error(`Dictionary already contains the given key: ${key}`);
            }
            scope._map.set(key, value);
        }

        Clear() {
            this._map.clear();
        }

        Remove(key) {
            this._map.delete(key);
        }

        ToArray() {
            let arr = [];
            this.ForEach((i, kvp) => {
                arr.push(kvp);
            });
            return arr;
        }

        ToEnumerable() {
            let arr = this.ToArray();
            return ParseDataAsEnumerable(arr);
        }

        GetEnumerator() {
            return new MapEnumerator(this._map);
        }
        ToJSON() {
            let str = this.Select(kvp=>`"${kvp.Key}":${JSON.stringify(kvp.Value)}`).Write(",");
            return `{${str}}`;
        }
        Clone() {
            const dict = new Dictionary();
            dict._map = new Map(this._map);
            return dict;
        }
    }

    class Lookup extends Dictionary{
        constructor() {
            super([]);
        }

        ContainsValue(val) {
            let scope = this;
            let result = false;
            scope.ForEach(kvp => {
                if (kvp.Value.Contains(val) > -1) {
                    result = true;
                    return false;
                }
            });
            return result;
        }

        Add(key, value) {
            let scope = this;
            if (scope._map.has(key) === false) {
                scope._map.set(key, ParseDataAsEnumerable([]));
            }
            scope._map.get(key).Data.push(value);
        }
		
		ToJSON() {
            let str = this.Select(kvp=>`"${kvp.Key}":${JSON.stringify(kvp.Value.ToArray())}`).Write(",");
            return `{${str}}`;
        }

        Set(key, value) {
            let scope = this;
            let val = ParseDataAsEnumerable(value);
            scope._map.set(key, val);
        }

        Clone() {
            const dict = new Lookup();
            dict._map = new Map(this._map);
            return dict;
        }
    }
    PublicEnumerable.Lookup = Lookup;
	PublicEnumerable.Dictionary = Dictionary;
	PublicEnumerable.Parallel = (()=>{
	 async function partitionSpawn(items,action){
		  let partitions = items.Batch(Math.ceil(items.Count()/8)).ToArray();

		  let promises = [];
		  let offset = 0;
		  for(let set of partitions){
			  let item = {
				Items: set.ToArray(),
				Offset: offset
			  };
			  let promise = spawn(item,action);
			  promises.push(promise);
			  offset += item.Items.length;
		  }
		  return Promise.all(promises);
	  }
	  async function spawn(items,action){
		  let pResolve = null;
		  let promise = new Promise( (resolve,reject)=>{
			  pResolve = resolve;
		  });
		  let blob = new Blob(
			[`try{
				  let obj = ${JSON.stringify(items)};
				  let rtn = [];
				  let idx = obj.Offset;
				  for(let item of obj.Items){
					  rtn.push(${action.toString()}(item,idx));
					  idx++;
				  }
				  self.postMessage(rtn);
				}
				catch(e){
					self.postMessage("Error:" + e.message + e.stack);
				}`
									 ], 
			   { type: "application/javascript" });

		  let blobURL = URL.createObjectURL(blob)
		  // Note: window.webkitURL.createObjectURL() in Chrome 10+.
		  let worker = new Worker(blobURL);
		  worker.onmessage = function(e) {
			pResolve(e.data);
			URL.revokeObjectURL(blobURL);
			worker.terminate();
		  }
		  return promise;
		}	
		
		async function Join(promise){
			var rtn = [];
			var results = await promise;
			if(results == null){
				return rtn;
			}
			for(let result of results){
				rtn = rtn.concat(result);
			}
			return rtn;
		}
			
		class Parallel{
			static async For(a,b,action){
				let rng = PublicEnumerable.Range(a,b-a + 1).ToArray();
				return Join(partitionSpawn(rng,action));
			}
			static async ForEach(collection,action){
				let rng = ParseDataAsArray(collection);
				return Join(partitionSpawn(rng,action));
			}
		}
		return Parallel;
		
	})();
	
	PublicEnumerable.Async = (()=>{
		
		class Async{
			static async ForSequential(a,b,action){
				let rng = PublicEnumerable.Range(a,b-a + 1).ToArray();
				return rng.AsyncSequential().ForEach(action);
			}
			static async ForEachSequential(collection,action){
				let rng = ParseDataAsArray(collection);
				return rng.AsyncSequential().ForEach(action);
			}
			static async MemoSequential(collection,cache,action){
				let rng = ParseDataAsArray(collection);
				return rng.AsyncSequential().MemoEach(cache,action);	
			}
			static async ForParallel(a,b,action){
				let rng = PublicEnumerable.Range(a,b-a + 1).ToArray();
				return rng.AsyncParallel().ForEach(action);
			}
			static async ForEachParallel(collection,action){
				let rng = ParseDataAsArray(collection);
				return rng.AsyncParallel().ForEach(action);
			}
			static async MemoParallel(collection,cache,action){
				let rng = ParseDataAsArray(collection);
				return rng.AsyncParallel().MemoEach(cache,action);
			}
		}
		return Async;
		
	})();	

    function ProfileItem(data,time){
		this.Data = data;
		this.Time = time;
	}
    Enumerable.Enums = {};
    Enumerable.Enums.OptimizeOptions = {
		Min: "Min",
		Max: "Max",
		SumMin: "SumMin",
		SumMax: "SumMax",
		Custom: "Custom"
	}
    // Internal Utilities
    Enumerable.Functions = {};
    Enumerable.Functions.Profile = (action, context, args) => {
		let a = Date.now();
		let rtn = action.apply(context, args);
		let b = Date.now();
		return new ProfileItem(rtn,b-a);
	}
    Enumerable.Functions.SortAsc = (a, b) => {
        if (a < b) {
            return -1;
        }
        if (a > b) {
            return 1;
        }
        return 0;
    }
    Enumerable.Functions.SortDesc = (a, b) => {
        if (a < b) {
            return 1;
        }
        if (a > b) {
            return -1;
        }
        return 0;
    }
    Enumerable.Functions.ShuffleSort = (a, b) => -0.5 + Math.random()
	Enumerable.Functions.Identity = (x) => x;

    // Misc code
    for (let prop in Enumerable.prototype) {
        Group.prototype[prop] = function() {
            return this.Items[prop](...CloneArray(arguments));
        }
    }


    // Create a short-hand, plus NoConflict
	if(window !== undefined){
		_Old = window._;
		window._ = PublicEnumerable;
	}
    return PublicEnumerable;
})());

function testEnumerable() {
    let arr = [];
    for (let i = 0; i < 1000000; i++) {
        arr.push({
            a: Math.floor(Math.random() * 300),
            b: Math.floor(Math.random() * 300),
            c: Math.floor(Math.random() * 300)
        });
    }
    let e = Enumerable.From(arr);

    function TimeAction(act) {
        let a = Date.now();
        act();
        let b = Date.now();
        console.log(b - a);
    }

    function xxx() {
        let joinData = [{
            "a": 30,
            "b": 30
        }, {
            "a": 50,
            "b": 5
        }];
        let h = e
            .Where(x => x.a <= 1500)
            .Select(x => ({
            name: x.a,
            transformed: Math.random(),
            transformed2: Math.random()
        }))
            .OrderByDescending(z => z.name)
            .ThenByDescending(z => z.transformed)
            .GroupBy(x => ({
                Name: x.name
            }))
            .OrderBy(x => x.Items.length)
            .FullJoin(
                joinData, z => ({a:z.Key.Name}), z2 => ({a:z2.a}), (a, b) => ({
                    "KEY": a ? a.Key : b.a,
					"NAME": a ? a.Key.Name : b.a,
                    "B": b ? b.b : null,
                    "LENGTH": a ? a.Items.Count() : 0,
					"A" : a,
					"B" : b
                }), (a) => ({
					"KEY": "Unmatched-LEFT",
					"NAME": a.Key.Name,
                    "LENGTH": a.Items.length					
				}), (b) => ({
					"KEY": "Unmatched-RIGHT",
					"NAME": b,
                    "LENGTH": b					
				})
            )
            .OrderByDescending(y => y.LENGTH)
            .ToArray();
        console.log(h);
    }

    function xxx2() {
        let joinData = [{
            "a": 30,
            "b": 30
        }, {
            "a": 50,
            "b": 5
        }];
        let arr = e.Data;
        let newArr = [];

        for (let item of arr) {
            if (item.a <= 1500) {
                newArr.push({
                    name: item.a,
                    transformed: Math.random(),
                    transformed2: Math.random()
                });
            }
        }

        newArr.sort((a, b) => {
            if (a.name < b.name) {
                return 1;
            }
            if (a.name > b.name) {
                return -1;
            }
            if (a.transformed < b.transformed) {
                return 1;
            }
            if (a.transformed > b.transformed) {
                return -1;
            }
            return 0;
        });

        let groups = [];
        let groupsIdx = [];

        for (let item of newArr) {
            let key = item.name;
            if (groupsIdx[key] == undefined) {
                groupsIdx[key] = groups.length;
                groups.push({
                    Items: [],
                    Key: key
                });
            }
            let idx = groupsIdx[key];
            groups[idx].Items.push(item);
        }

        newArr = groups;

        newArr.sort((a, b) => {
            if (a.Items.length > b.Items.length) {
                return 1;
            }
            if (a.Items.length < b.Items.length) {
                return -1;
            }
            return 0;
        });
        console.log(newArr);
    }

    TimeAction(xxx);
    //TimeAction(xxx2);
}




function test() {
    let numbers = Enumerable.RangeTo(1, 1000000).ToArray()
    let e = Enumerable.From(numbers);
    let a = Date.now();
    let sumOfEvenSquares = e
        .Where(n => n % 2 === 0)
        .Select(n => n * n).ToArray()
    let b = Date.now()
    return b - a;
}

//let eBig = _.Range(0, 1000000, 1);
//let eSmall = _.Range(0, 100, 1);
//let eMed = _.Range(0, 25000, 1);
