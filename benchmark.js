function testEnumerable() {
    let arr = [];
    for (let i = 0;i <1000000; i++) {
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
            .Select(function(x) {
                return {
                    name: x.a,
                    transformed: Math.random(),
                    transformed2: Math.random()
                }
            })
            .OrderByDescending(z => z.name)
            .ThenByDescending(z => z.transformed)
            .GroupBy(x => ({Name:x.name}))
            .OrderBy(x => x.Items.length)
            /*.FullJoin(
                joinData, z => z.Key.Name, z2 => z2.a, (a, b) => ({
                    "KEY": a.Key,
					"NAME": a.Key.Name,
                    "B": b.b,
                    "LENGTH": a.Items.length
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
            .OrderByDescending(y => y.LENGTH)*/
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
		for(let i = 0; i < arr.length; i++){
			let item = arr[i];
			if(item.a <= 1500){
				newArr.push({
					name: item.a,
					transformed: Math.random(),
					transformed2:Math.random()
				});
			}
		}
		newArr.sort(function(a,b){
			if(a.name < b.name){
				return 1;
			}
			if(a.name > b.name){
				return -1;
			}
			if(a.transformed < b.transformed){
				return 1;
			}
			if(a.transformed > b.transformed){
				return -1;
			}
			return 0;
		});
		
            let groups = [];
            let groupsIdx = [];
            for (let i = 0; i < newArr.length; i++) {
                let item = newArr[i];
                let key = item.name;
                if (groupsIdx[key] == undefined) {
                    groupsIdx[key] = groups.length;
                    groups.push({Items:[],Key:key});
                }
                let idx = groupsIdx[key];
                groups[idx].Items.push(item);
            }
            newArr = groups;
			
        newArr.sort(function(a,b){
			if(a.Items.length > b.Items.length){
				return 1;
			}
			if(a.Items.length < b.Items.length){
				return -1;
			}
			return 0;
		});
		console.log(newArr);
    }
	
    TimeAction(xxx);
    TimeAction(xxx2);
}
