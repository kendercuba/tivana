import { useEffect, useState, Fragment } from "react";
import {
ChevronDownIcon,
ChevronRightIcon,
PencilIcon,
TrashIcon,
PlusIcon,
MagnifyingGlassIcon
} from "@heroicons/react/24/outline";


export default function AdminCategoryTree(){

const API_URL = import.meta.env.VITE_API_URL;

const [categories,setCategories] = useState([]);
const [expandedCategories,setExpandedCategories] = useState({});
const [expandedSubcategories,setExpandedSubcategories] = useState({});
const [search,setSearch] = useState("");
const [openCategories, setOpenCategories] = useState({});
const [openSubcategories, setOpenSubcategories] = useState({});
const [bulkType,setBulkType] = useState("category");
const [bulkParentCategory,setBulkParentCategory] = useState("");
const [bulkParentSubcategory,setBulkParentSubcategory] = useState("");
const [bulkText,setBulkText] = useState("");

const [modal,setModal] = useState({
open:false,
type:null,
id:null,
parentId:null,
value:"",
title:""
});

/* LOAD DATA */

const reloadData = async () => {

  try {

    const res = await fetch(
      `${API_URL}/admin/taxonomy-tree`,
      { credentials: "include" }
    );

    const data = await res.json();

    setCategories(data);

  } catch (err) {

    console.error("Error cargando taxonomy tree:", err);

  }

};

useEffect(()=>{
reloadData();
},[]);

/* TOGGLES */

const toggleCategory = id=>{
setExpandedCategories(prev=>({...prev,[id]:!prev[id]}));
};

const toggleSubcategory = id=>{
setExpandedSubcategories(prev=>({...prev,[id]:!prev[id]}));
};

/* MODAL */

const openModalRename = (type,id,name)=>{
setModal({
open:true,
type,
id,
parentId:null,
value:name,
title:`Editar ${type}`
});
};

const openModalAdd = (type,parentId)=>{
setModal({
open:true,
type,
id:null,
parentId,
value:"",
title:`Nuevo ${type}`
});
};

const closeModal = ()=>{
setModal({
open:false,
type:null,
id:null,
parentId:null,
value:"",
title:""
});
};

/* SAVE */

const saveModal = async ()=>{

if(!modal.value.trim()) return;

const endpoints = {
category:"admin/categories",
subcategory:"admin/subcategories",
subsubcategories:"admin/subsubcategories"
};

let body={};

if(modal.id){

body={name:modal.value};

await fetch(`${API_URL}/${endpoints[modal.type]}/${modal.id}`,{
method:"PUT",
headers:{'Content-Type':'application/json'},
body:JSON.stringify(body)
});

}else{

if(modal.type==="category"){
body={name:modal.value};
}

if(modal.type==="subcategory"){
body={name:modal.value,category_id:modal.parentId};
}

if(modal.type==="subsubcategories"){
body={name:modal.value,subcategory_id:modal.parentId};
}

await fetch(`${API_URL}/${endpoints[modal.type]}`,{
method:"POST",
headers:{'Content-Type':'application/json'},
body:JSON.stringify(body)
});

}

closeModal();
reloadData();

};

/* DELETE */

const handleDelete = async(type,id)=>{

if(!confirm("Eliminar elemento?")) return;

const endpoints={
category:"admin/categories",
subcategory:"admin/subcategories",
subsubcategories:"admin/subsubcategories"
};

await fetch(`${API_URL}/${endpoints[type]}/${id}`,{
method:"DELETE"
});

reloadData();

};


const handleSearch = (value) => {

setSearch(value);

if(value.trim() === ""){
setOpenCategories({});
setOpenSubcategories({});
return;
}

const searchLower = value.toLowerCase();

const newOpenCats = {};
const newOpenSubs = {};

categories.forEach(cat=>{

// match categoría
if(cat.name.toLowerCase().includes(searchLower)){
newOpenCats[cat.id] = true;
}

cat.subcategories?.forEach(sub=>{

// match subcategoría
if(sub.name.toLowerCase().includes(searchLower)){
newOpenCats[cat.id] = true;
newOpenSubs[sub.id] = true;
}

sub.subsubcategories?.forEach(ss=>{

// match subsubcategoría
if(ss.name.toLowerCase().includes(searchLower)){
newOpenCats[cat.id] = true;
newOpenSubs[sub.id] = true;
}

});

});

});

setOpenCategories(newOpenCats);
setOpenSubcategories(newOpenSubs);

};


const filterTree = (cats, search) => {

if(!search) return cats;

const searchLower = search.toLowerCase();

return cats.map(cat => {

const filteredSubs = cat.subcategories?.map(sub => {

const filteredSubSubs = sub.subsubcategories?.filter(ss =>
ss.name.toLowerCase().includes(searchLower)
);

const subMatch = sub.name.toLowerCase().includes(searchLower);

if(subMatch || filteredSubSubs?.length){

return {
...sub,
subsubcategories: filteredSubSubs
};

}

return null;

}).filter(Boolean);

const catMatch = cat.name.toLowerCase().includes(searchLower);

if(catMatch || filteredSubs?.length){

return {
...cat,
subcategories: filteredSubs
};

}

return null;

}).filter(Boolean);

};


/* CREAR CATEGORIAS MASIVAMENTE  */

const handleBulkCreate = async () => {

if(!bulkText.trim()) return;

const lines = bulkText
.split("\n")
.map(l => l.trim())
.filter(Boolean);

for(const name of lines){

let body = {};

if(bulkType === "category"){

body = { name };

await fetch(`${API_URL}/admin/categories`,{
method:"POST",
headers:{'Content-Type':'application/json'},
body:JSON.stringify(body)
});

}

if(bulkType === "subcategory"){

body = {
name,
category_id: bulkParentCategory
};

await fetch(`${API_URL}/admin/subcategories`,{
method:"POST",
headers:{'Content-Type':'application/json'},
body:JSON.stringify(body)
});

}

if(bulkType === "subsubcategories"){

body = {
name,
subcategory_id: bulkParentSubcategory
};

await fetch(`${API_URL}/admin/subsubcategories`,{
method:"POST",
headers:{'Content-Type':'application/json'},
body:JSON.stringify(body)
});

}

}

setBulkText("");

reloadData();

};



return(

<div className="p-6">


{/* BULK CREATOR */}

<div className="border rounded p-4 mb-6 bg-gray-50">

<div className="flex gap-3 mb-3">

<select
value={bulkType}
onChange={e=>setBulkType(e.target.value)}
className="border px-2 py-1 text-sm rounded"
>
<option value="category">Categoría</option>
<option value="subcategory">Subcategoría</option>
<option value="subsubcategories">Subsubcategoría</option>
</select>

{bulkType !== "category" && (

<select
value={bulkParentCategory}
onChange={e=>setBulkParentCategory(e.target.value)}
className="border px-2 py-1 text-sm rounded"
>

<option value="">Seleccionar categoría</option>

{filterTree(categories, search).map(cat => (
<option key={cat.id} value={cat.id}>
{cat.name}
</option>
))}

</select>

)}

{bulkType === "subsubcategories" && (

<select
value={bulkParentSubcategory}
onChange={e=>setBulkParentSubcategory(e.target.value)}
className="border px-2 py-1 text-sm rounded"
>

<option value="">Seleccionar subcategoría</option>

{categories.flatMap(cat =>
cat.subcategories.map(sub=>(
<option key={sub.id} value={sub.id}>
{sub.name}
</option>
))
)}

</select>

)}

</div>

<textarea
placeholder="Pegar lista (una por línea)"
value={bulkText}
onChange={e=>setBulkText(e.target.value)}
className="border w-full h-28 p-2 text-sm rounded mb-3"
/>

<button
onClick={handleBulkCreate}
className="bg-gray-800 text-white px-4 py-1 text-sm rounded"
>
Crear masivamente
</button>

</div>


{/* SEARCH */}

<div className="relative mb-4">

<MagnifyingGlassIcon className="h-4 absolute left-3 top-2 text-gray-400"/>

<input
className="border w-full pl-8 py-1.5 text-sm rounded"
placeholder="Buscar categoría..."
value={search}
onChange={e=>handleSearch(e.target.value)}
/>

</div>


{/* TABLE */}

<table className="w-full text-sm border rounded">

<thead className="bg-gray-200 text-gray-700 text-xs">

<tr>

<th className="px-2 py-1 text-left w-16">Tipo</th>

<th className="px-2 py-1 text-left w-16">ID</th>

<th className="px-2 py-1 text-left">

<div className="flex items-center gap-2">

<span>Categorías</span>

<PlusIcon
className="h-4 text-gray-500 cursor-pointer hover:text-gray-800"
title="Agregar categoría"
onClick={()=>openModalAdd("category",null)}
/>

</div>

</th>

<th className="px-2 py-1 text-left w-24">Items</th>

</tr>

</thead>

<tbody>

{filterTree(categories, search).map((cat,i)=>(
<Fragment key={cat.id}>

<tr
key={cat.id}
onClick={()=>toggleCategory(cat.id)}
className={`border-t cursor-pointer hover:bg-gray-100 ${i%2===0?"bg-white":"bg-gray-50"}`}
>

<td className="px-2 py-1 text-xs text-gray-600 font-medium w-[160px] flex items-center gap-1">
Categoría

<button
onClick={()=>toggleCategory(cat.id)}
className="w-4 flex justify-center"
>

{expandedCategories[cat.id]
? <ChevronDownIcon className="h-4 w-4"/>
: <ChevronRightIcon className="h-4 w-4"/>}

</button>

</td>

<td className="p-2">{cat.id}</td>

<td className="px-2 py-1 font-semibold flex items-center gap-2">

<span>📦</span>

<span className="flex items-center gap-2">

{cat.name} 
<span className="text-gray-500 text-xs">
({cat.subcategories?.length || 0})
</span>

<PencilIcon
className="h-3.5 text-gray-500 cursor-pointer"
onClick={(e)=>{
e.stopPropagation()
openModalRename("category",cat.id,cat.name)
}}
/>

<TrashIcon
className="h-3.5 text-gray-500 cursor-pointer"
onClick={(e)=>{
e.stopPropagation()
handleDelete("category",cat.id)
}}
/>

<PlusIcon
className="h-3.5 text-gray-500 cursor-pointer"
onClick={(e)=>{
e.stopPropagation()
openModalAdd("subcategory",cat.id)
}}
/>

</span>

</td>

<td className="p-2">{cat.total_items}</td>

</tr>

{(expandedCategories[cat.id] || openCategories[cat.id]) && cat.subcategories?.map((sub,j)=>(
<>

<tr
key={sub.id}
onClick={()=>toggleSubcategory(sub.id)}
className={`border-t cursor-pointer hover:bg-gray-200 ${j%2===0?"bg-gray-50":"bg-gray-100"}`}
>

<td className="px-2 py-1 text-xs text-gray-600 font-medium w-[160px] flex items-center gap-1">
Subcategoría


<button onClick={()=>toggleSubcategory(sub.id)}>

{expandedSubcategories[sub.id]
? <ChevronDownIcon className="h-4"/>
: <ChevronRightIcon className="h-4"/>}

</button>

</td>

<td className="p-2">{sub.id}</td>

<td className="px-2 py-1 flex items-center gap-2 pl-6">

<span className="text-gray-400">├─</span>

<span>📁</span>
{sub.name} 
<span className="text-gray-500 text-xs">
({sub.subsubcategories?.length || 0})
</span>

<PencilIcon
className="h-3.5 text-gray-500 cursor-pointer"
onClick={(e)=>{
e.stopPropagation()
openModalRename("subcategory",sub.id,sub.name)
}}
/>

<TrashIcon
className="h-3.5 text-gray-500 cursor-pointer"
onClick={(e)=>{
e.stopPropagation()
handleDelete("subcategory",sub.id)
}}
/>

<PlusIcon
className="h-3.5 text-gray-500 cursor-pointer"
onClick={(e)=>{
e.stopPropagation()
openModalAdd("subsubcategories",sub.id)
}}
/>

</td>

<td className="p-2">{sub.total_items}</td>

</tr>

{(expandedSubcategories[sub.id] || openSubcategories[sub.id]) && sub.subsubcategories?.map((ss,k)=>(

<tr
key={ss.id}
className={`border-t ${k%2===0?"bg-gray-100":"bg-gray-200"}`}
>

<td className="px-2 py-1 text-xs text-gray-600 font-medium w-[160px] flex items-center gap-1">
Sub-sub

</td>

<td className="p-2">{ss.id}</td>

<td className="px-2 py-1 flex items-center gap-2 pl-12 text-gray-700">

<span className="text-gray-400">├─</span>

<span>📄</span>

<span className="flex items-center gap-2">

{ss.name} 
<span className="text-gray-500 text-xs">
({ss.total_items || 0})
</span>

<PencilIcon
className="h-3.5 text-gray-500 cursor-pointer"
onClick={(e)=>{
e.stopPropagation()
openModalRename("subsubcategories",ss.id,ss.name)
}}
/>

<TrashIcon
className="h-3.5 text-gray-500 cursor-pointer"
onClick={(e)=>{
e.stopPropagation()
handleDelete("subsubcategories",ss.id)
}}
/>

</span>
</td>

<td className="p-2">{ss.total_items}</td>

</tr>
))}

</>
))}

</Fragment>
))}

</tbody>

</table>

{/* MODAL */}

{modal.open &&(

<div className="fixed inset-0 bg-black/40 flex items-center justify-center">

<div className="bg-white p-5 rounded w-80">

<h2 className="font-semibold mb-3">{modal.title}</h2>

<input
className="border w-full px-2 py-1 text-sm mb-4"
value={modal.value}
onChange={e=>setModal(m=>({...m,value:e.target.value}))}
/>

<div className="flex justify-end gap-2">

<button
onClick={closeModal}
className="px-3 py-1 bg-gray-200 rounded text-sm"

>

Cancelar </button>

<button
onClick={saveModal}
className="px-3 py-1 bg-gray-800 text-white rounded text-sm"

>

Guardar </button>

</div>

</div>

</div>

)}

</div>

);

}
