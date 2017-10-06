
let Enumerable = ((() => {
    // Private constant variables for module
    let InvalidItem;

    // Private Classes for module
    class BasePredicate{
		constructor(){
			let args = Array.from(arguments)[0];
			if(args != null){
				this._Arguments = new Array(args.length);
			} else {
				this._Arguments = new Array(0);				
			}
			for(let i = 0; i < this._Arguments.length; ++i){
				this._Arguments[i] = args[i];
			}
		}
		//workaround until code can be fully ported to classes. Max/Min are only obstacles currently
		static Apply(){
			let args = Array.from(arguments)[0];
			if(args != null){
				this._Arguments = new Array(args.length);
			} else {
				this._Arguments = new Array(0);				
			}
			for(let i = 0; i < this._Arguments.length; ++i){
				this._Arguments[i] = args[i];
			}
			this.Reconstruct = function(){
	            return Reflect.construct(this.constructor, this._Arguments);		
			}
		}
        Reconstruct() {
	        return Reflect.construct(this.constructor, this._Arguments);		
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
            let rtn = Array.from(this.Hash.values());
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

    function EnumeratorItem(val, done) {
        this.Value = val;
        this.Done = done;
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
                        let val = this.Func(...args);
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

        SetCache(args, value) {
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

        Call() {
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
                        this.Func(...newArgs);
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
    }

    class AsyncToken {
        constructor(owner) {
            this.Owner = owner;
            this.Reason = new BaseReason();
            this.Events = new EventManager();
        }

        Reject(data) {
            this.Reason = new RejectReason(data);
            this.Events.FireEvent("OnReject",[data]);
        }

        Resolve(data) {
            this.Reason = new ResolveReason(data);
            this.Events.FireEvent("OnResolve",[data]);
        }

        Clone() {
            let token = new AsyncToken(this.Owner);
            token.Reason = this.Reason;
            token.Events = this.Events.Clone();
            return token;
        }
    }

    class BaseReason {
        constructor(data) {
            this.Data = data;
        }

        IsReject() {
            return this instanceof RejectReason;
        }

        IsResolve() {
            return this instanceof ResolveReason;
        }
    }

	class RejectReason extends BaseReason{
		constructor(data){
			super(data);
		}
	}
	class ResolveReason extends BaseReason{
		constructor(data){
			super(data);
		}
	}
	
    class EventManager {
        constructor() {
            this.Events = {};
        }

        FireEvent(evt, data) {
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

        BindEvent(evt, action) {
            if (this.Events[evt] === undefined) {
                this.Events[evt] = [];
            }
            this.Events[evt].push(action);
        }

        UnbindEvent(evt, action) {
                if (this.Events[evt] !== undefined) {
                    let newArr = [];

                    for (let event of this.Events[evt]) {
                        if (event !== action) {
                            newArr.push(event);
                        }
                    }

                    this.Events[evt] = newArr;
                }
            }

        Clone() {
            const em = new EventManager();
            em.Events = {};
            for(let prop in this.Events){
                em.Events[prop] = this.Events[prop];
            }
            return em;
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
		let arr = Array.from(data);
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
		let arr = Array.from(data);
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
    class PublicEnumerable {
        constructor(data) {
            let d = ParseDataAsArray(data);
            return new Enumerable({
                Data: d
            });
        }
		
        // Static methods for Enumerable

        //Modify Enumerable.prototype
        static Extend(extenderMethod) {
                extenderMethod(Enumerable.prototype);
            }
        // The preferred smart constructor

        static From(data) {
                return ParseDataAsEnumerable(data);
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
                if(newVal !== InvalidItem){
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
                if(newVal !== InvalidItem){
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
                    p[prop] = function(a,b,c,d,e,f,g,h,i,j,k,l) {
                        let enumerable = new Enumerable({Data: dataGetter(this)});
                        if(arguments.length > 12){
                            return enumerable[prop](...arguments);
                        }
                        return enumerable[prop](a,b,c,d,e,f,g,h,i,j,k,l);
                    }
                }
                if(addIterator){
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
            }

        static ExtendArrays() {
            let p = Array.prototype;
			let propertyNames = Object.getOwnPropertyNames(Enumerable.prototype);
                for (let prop of propertyNames) {

                    if (typeof Enumerable.prototype[prop] !== "function") {
                        continue;
                    }
                    
                    p[prop] = function(a,b,c,d,e,f,g,h,i,j,k,l) {
                        let enumerable = new Enumerable({Data: this});
                        if(arguments.length > 12){
                            return enumerable[prop](...arguments);
                        }
                        return enumerable[prop](a,b,c,d,e,f,g,h,i,j,k,l);
                    }
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
                    _.Inherit(thing,x=>Array.from(x),false);
					_extendedObjects[key] = thing.prototype;
                }
            }
        }

        static NoConflict() {
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
	let _extendedObjects = {};

    // The private constructor. Define EVERYTHING in here
    class Enumerable {
        constructor(privateData) {
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
            scope.ForEachActionStack = [DEFAULTFOREACHACTIONPREDICATE];
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

		static Apply(privateData){
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
            scope.ForEachActionStack = [DEFAULTFOREACHACTIONPREDICATE];
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
		toString(){
			return `[${this.ToString(",")}]`;
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
            return item == InvalidItem;
        }

        ToEnumerable() {
            return this.Clone();
        }

        ToArray() {
            let arr = this.Data;
            arr = this.ForEachActionStack[this.ForEachActionStack.length - 1].Execute(arr);
            arr = ProcessPredicates(this.Predicates, arr);
            return arr;
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
            let arr = this.Data;
            arr = this.ForEachActionStack[this.ForEachActionStack.length - 1].Execute(arr);
            ProcessPredicatesNoReturn(this.Predicates, arr, action, closureObject);
            return;
        }

        MemoEach(cache, action) {
            let memo = new MemoizeFunc(cache);
            action = action || function memoEachDoNothing(){};
            this.ForEach((i, v) => {
                let val = memo.Call(v);
                action(val);
            });
        }

        MemoEachAsync(cache, action) {
            let pending = new Map();
            let waitList = new Map();
            action = action || function memoEachAsyncDoNothing(){};
            let memo = new MemoizeFuncAsync(cache,action);
            memo.Events.BindEvent("OnResolve", (val, args) => {
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
            memo.Events.BindEvent("OnReject", (val, args) => {
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
            this.ForEach((i, v) => {
                if(pending.has(v) === false){
                    pending.set(v,true);
                    waitList.set(v,[]);
                    memo.Call(v);
                } else {
                    waitList.get(v).push(v);
                }
            });
        }

        Where(pred) {
            let scope = this;
            let data = CreateDataForNewEnumerable(scope);
            data.WherePredicate = new WherePredicate(pred);
            return new FilteredEnumerable(data);
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
            let scope = this;
            let p = new FirstPredicate(pred);
            return p.Execute(scope).First;
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
            return first !== null;
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
                } else {
                    item.CompareValue = Number.NEGATIVE_INFINITY;
                }
            }
            for(let item of data){
                for(let opt of optClone){
                    let pVal = opt.Predicate(item);
                    if(opt.OptimizeOption == Enumerable.Enums.OptimizeOptions.Min){
                        if(pVal < opt.CompareValue){
                            opt.CompareValue = pVal;
                        }
                    } else {
                        if(pVal > opt.CompareValue){
                            opt.CompareValue = pVal;
                        }
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
            if (!pred) {
                rtn = scope.Aggregate((curr, next) => curr + symbol + next);
                return rtn === null ? "" : rtn;
            }
            rtn = scope.Aggregate((curr, next) => curr + symbol + pred(next));
            return rtn === null ? "" : rtn;
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

        static CreateSortFunction(pred, desc) {
            if (desc) {
                return (a, b) => {
                    let aa = pred(a);
                    let bb = pred(b);
                    return Enumerable.Functions.SortDesc(aa, bb);
                }
            }
            return (a, b) => {
                let aa = pred(a);
                let bb = pred(b);
                return Enumerable.Functions.SortAsc(aa, bb);
            }
        }

        static CreateCompositeSortFunction(oldComparer, pred, desc) {
            let newSort = Enumerable.CreateSortFunction(pred, desc);
            return (a, b) => {
                let initialResult = oldComparer(a, b);
                if (initialResult !== 0) {
                    return initialResult;
                }
                return newSort(a, b);
            }
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
            let newArr = this.OldForEachActionPredicate.Execute(arr);
            newArr = ProcessPredicates(this.OldPredicates, newArr);
            newArr = this.Action(newArr);
            return newArr;			
		}
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

    class WherePredicate extends BasePredicate{
        constructor(pred) {
            super(arguments);
            this.Predicate = pred;

        }

        Execute(item, i) {
            let passed = this.Predicate(item, i);
            if (passed) {
                return item;
            }
            return InvalidItem;
        }

        Reset() {}
    }

    class SelectPredicate extends BasePredicate{
        constructor(pred) {
            super(arguments);
            this.Predicate = pred;
        }

        Execute(item, i) {
            return this.Predicate(item, i)
        }

        Reset() {}
    }

    class DistinctPredicate extends BasePredicate{
        constructor(pred) {
            super(arguments);
            this.Hash = new HashMap(pred);
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

    class SkipPredicate extends BasePredicate{
        constructor(cnt) {
            super(arguments);
            this.Skipped = 0;
            this.SkipCount = cnt;
        }

        Predicate(item) {
                if (this.Skipped < this.SkipCount) {
                    this.Skipped++;
                    return InvalidItem;
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

    class SkipWhilePredicate extends BasePredicate{
        constructor(pred) {
            super(arguments);
            this.CanSkip = true;
            this._predicate = pred;
        }

        Predicate(item) {
            if (!this.CanSkip) {
                return item;
            }
            this.CanSkip = pred(item);
            if (this.CanSkip) {
                return InvalidItem;
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

    class TakePredicate extends BasePredicate{
        constructor(cnt) {
            super(arguments);
            this.Took = 0;
            this.TakeCount = cnt;
            this.CanTake = true;
        }

        Predicate(item) {
            if (this.Took >= this.TakeCount) {
                this.CanTake = false;
                return InvalidItem;
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

    class TakeWhilePredicate extends BasePredicate{
        constructor(pred) {
            super(arguments);
            this.CanTake = true;
            this._predicate = pred;
        }

        Predicate(item) {
            if (!this.CanTake) {
                return InvalidItem;
            }
            this.CanTake = pred(item);
            if (!this.CanTake) {
                return InvalidItem;
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

    class FirstPredicate extends BasePredicate {
		constructor(pred){
			super(arguments);
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
    class LastPredicate extends BasePredicate {
		constructor(pred){
			super(arguments);
			this.Predicate = pred;
			this._last = null;
			this._lastIndex = -1;
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

    class AllPredicate extends BasePredicate{
        constructor(pred) {
            super(arguments);
            this._predicate = pred;
            this._all = true;
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

    class UnionPredicate extends BasePredicate{
        constructor(items, pred, pred2) {
            super(arguments);
            let scope = this;
            this.Items = items;
            this.Predicate = pred || (x => x)
            this.Predicate2 = pred2 || (x => x)
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

    class IntersectPredicate extends BasePredicate{
        constructor(items, pred, pred2) {
            super(arguments);
            this.Items = items;
            this.Predicate = pred || (x => x)
            this.Predicate2 = pred2 || (x => x)
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

    class DisjointPredicate extends BasePredicate{
        constructor(items, pred, pred2) {
            super(arguments);
            let scope = this;
            this.Items = items;
            this.Predicate = pred || (x => x)
            this.Predicate2 = pred2 || (x => x)
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

    class SplitPredicate extends BasePredicate{
        constructor(pred, includeSplitter) {
            super(Array.from(arguments));
            this.Predicate = pred;
            this.IncludeSplitter = includeSplitter;
            this.CurrentGroup = [];
            this.NeedsFlush = false;
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

    class SplitByPredicate extends BasePredicate{
        constructor(sequence, pred, includeSplitter) {
            super(Array.from(arguments));
            this.Predicate = pred || this._defaultPred;
            this.IncludeSplitter = includeSplitter;
            this.CurrentGroup = [];
            this.CurrentSequence = [];
            this.Sequence = ParseDataAsArray(sequence);
            this.NeedsFlush = false;
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

    class BatchPredicate extends BasePredicate{
        constructor(cnt) {
            super(Array.from(arguments));
            this.CurrentSequence = [];
            this.BatchSize = cnt;	
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

    class RemovePredicate extends BasePredicate {
        constructor(items) {
            super(arguments);
            this.Items = ParseDataAsEnumerable(items);
            this.ItemsToCheck;		
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
            return InvalidItem;
        }
    }

    class RemoveAtPredicate extends BasePredicate {
        constructor(idx, cnt) {
            super(arguments);
            this.Index = idx;
            this.Count = cnt || 1;
            this.RemoveCount = 0;
            this.BeganRemove = false;      		
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
                    return InvalidItem;
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

    class CatchPredicate extends BasePredicate{
        constructor(handler, refPred) {
            super(arguments);
            this.Handler = handler;
            this.HandledPredicate = refPred;
        }

        Predicate(item) {
            try {
                return this.HandledPredicate.Execute(item);
            } catch (e) {
                this.Handler(e, item);
                return InvalidItem;
            }
        }

        Reset() {}

        Execute(item) {
            return this.Predicate(item);
        }
    }

    class TracePredicate extends BasePredicate{
        constructor(msg) {
            super(arguments);
            this.Message = msg;
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
        constructor(enumerable, interval) {
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

        ForEach(action) {
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
            scope.Events.BindEvent("OnComplete", data => {
                completed = true;
            });
            
            let tryOnComplete = () => {
                if(completed === true || rejected === true){
                    return false;
                }
                if(scope.CompleteCount === scope.TotalCount && scope.Enumerator.Current === undefined){
                    scope.Events.FireEvent("OnComplete");
                    return false;
                }
                return true;			
            }
            let Iteration = () => {
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

        Then(item) {
            this.Enumerator.AddItem(item);
            return this;
        }

        Catch(handler) {
            this.Events.BindEvent("OnError",handler);
            return this;
        }

        Finally(onDone) {
            this.Events.BindEvent("OnComplete",onDone);	
            return this;
        }

        FinallyEnumerated(onDone) {
            this.Events.BindEvent("OnEnumerationComplete",onDone);		
            return this;
        }
    }

    class AsyncSequential {
        constructor(enumerable) {
            this.Token = new AsyncToken(this);
            this.Enumerator = new EnumeratorCollection();
            this.Enumerator.AddItems(enumerable);
            this.Events = new EventManager();		
        }

        ForEach(action) {
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
            
            let Iteration = () => {
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

        Then(item) {
            this.Enumerator.AddItem(item);
            return this;
        }

        Catch(handler) {
            this.Events.BindEvent("OnError",handler);
            return this;
        }

        Finally(onDone) {
            this.Events.BindEvent("OnComplete",onDone);	
            return this;
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
            let rtn = Array.from(this._map.keys());
            return ParseDataAsEnumerable(rtn);
        }

        get Values() {
            let rtn = Array.from(this._map.values());
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


    function ProfileItem(data,time){
		this.Data = data;
		this.Time = time;
	}
    Enumerable.Enums = {};
    Enumerable.Enums.OptimizeOptions = {
		Min: "Min",
		Max: "Max"
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

    // Misc code
    for (let prop in Enumerable.prototype) {
        Group.prototype[prop] = function() {
            return this.Items[prop](...Array.from(arguments));
        }
    }


    // Create a short-hand, plus NoConflict
    let _Old = window._;
    window._ = PublicEnumerable;
    return PublicEnumerable;
})());
