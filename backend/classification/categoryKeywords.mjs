import { normalizeText, tokenize } from "./semantic/similarityEngine.mjs";

export const categoryKeywords = {

  "ropa": {
    strong: [
      "camiseta","camisetas","pantalon","pantalones","short","shorts","bermuda",
      "falda","vestido","blusa","jeans","vaquero","sudadera","hoodie",
      "chaqueta","abrigo","polo","playera","camisa","sueter","sueteres",
      "sudadera","leggings","pijama","bikini","traje baño","ropa interior",
      "calcetin","calcetines","panty","brasier","sosten","corset",
      "chaleco","traje","conjunto","uniforme","quitapelusas","rodillo pelusa"
    ],
    medium: [
      "algodon","manga","casual","moda","verano","invierno","deportivo",
      "tela","estampado","bordado"
    ],
    weak: ["hombre","mujer","niño","niña"]
  },

 "calzado": {
 strong: [
  "zapato","zapatos",
  "zapatilla","zapatillas",
  "tenis",
  "botas",
  "sandalia","sandalias",
  "tacon","tacones",
  "suela",
  "chancla","chanclas",
  "pantufla","pantuflas",
  "mocasines",
  "alpargata",
  "botin","botines",
  "cubrezapatos"
 ],
 medium: [
  "calzado",
  "calzado deportivo"
 ],
 weak: []
},

  "accesorios": {
    strong: [
      "broche","boton","extensor","hebilla","clip","accesorio",
      "cinturon","bufanda","gafas","lentes","sombrero","gorra",
      "diadema","pasador","pinza cabello","mochila pequeña"
    ],
    medium: [
      "moda","complemento"
    ],
    weak: []
  },

  "electrónica": {
    strong: [
      "usb","cargador","audifono","audifonos","parlante","bocina",
      "monitor","pantalla","powerbank","bateria","teclado",
      "mouse","raton","microfono","camara","webcam","tablet",
      "adaptador","control remoto","led","lampara led"
    ],
    medium: [
      "electronica","tecnologia","dispositivo","digital"
    ],
    weak: []
  },

  "hogar y cocina": {
  strong: [
    "cocina","utensilio","utensilios","vajilla", "sarten",
    "frasco","lonchera","rallador","pelador","cortador","mandolina",
    "tabla cocina","espatula","cuchara","tenedor",
    "cuchillo","sarten","olla", "tabla cortar",
    "vaso","taza", "tazas", "plato","escurridor","colador",
     "almohada", "funda almohada", "funda de almohada",
    "fundas almohada", "pillowcase", "ropa cama", "sabanas","edredon",
    "organizador", "organizador cocina", "organizador hogar", 
    "bano", "baño", "toallas", "toalla", "cortina", "cortinas", "cortina bano", "cortina sala",
    "cojines","cojin",
    "decoracion", "decoracion hogar", "decoracion pared",
    "alfombra", "dormitorio", "molde", "molde silicona", "tapa", "tapa olla", "pintura decorativa", "marco",
    "marcos", "marco decorativo", "botella", "botellas", "tarros", "termos", "percha", "perchas","pegatina",
    "pegatinas", "persiana", "persianas", "herramientas para frutas", "herramientas para pasta", "herramientas para carne",
    "espejo", "espejos", "esponjas", "estropajos","zapatero", "zapateros", "tapete", "tapetes","panel","paneles","colgante",
    "colgantes", "cinta adhesiva", "cintas", "bolsas", "bolsa", "bolsas de Basura","bolsas de almacenamiento", "bolsas de compra"
    
  ],
  medium: [
    "hogar","casa","almacenamiento","organizacion", "almacenamiento", 
    "organizacion", "accesorios hogar"
  ],
  weak: []
},

  "juguetes": {
    strong: [
      "juguete","muñeca","peluche","rompecabezas",
      "figura accion","bloques","lego","carrito juguete",
      "pistola juguete","tren juguete"
    ],
    medium: [
      "niños","infantil","didactico", "juego"
    ],
    weak: []
  },

  "belleza y cuidado personal": {
    strong: [
      "maquillaje","cosmetico","cosmeticos","crema","serum",
      "locion","shampoo","acondicionador","cepillo","peine",
      "secador","plancha cabello","rizador","labial","rimel",
      "brocha maquillaje","esponja maquillaje","cosmetiquera",
      "neceser","perfume","desodorante","gel cabello",
      "cortauñas","maquina afeitar","afeitadora", "estuche maquillaje"
  

    ],
    medium: [
      "belleza","skincare","cabello","cuidado personal"
    ],
    weak: []
  },

  "deportes y aire libre": {
    strong: [
      "gym","fitness","camping","senderismo","hamaca",
      "yoga","pesas","mancuerna","colchoneta","bicicleta",
      "balon","raqueta","tienda campaña","linterna camping",
      "mochila camping"
    ],
    medium: [
      "deporte","ejercicio","entrenamiento","aire libre"
    ],
    weak: []
  },

  "mascotas": {
    strong: [
      "perro","gato","correa","collar mascota","comedero",
      "bebedero mascota","juguete perro","juguete gato",
      "arena gato","cama mascota","transportin mascota"
    ],
    medium: [
      "mascota","animal"
    ],
    weak: []
  },

  "relojes y joyas": {
    strong: [
      "reloj","joyero","collar","anillo","pulsera","cadena",
      "pendiente","arete","broche joya","reloj pulsera"
    ],
    medium: [
      "joyeria","accesorio joya"
    ],
    weak: []
  },

  "salud": {
    strong: [
      "terapia","masaje","vendaje","ortopedia","corrector",
      "termometro","tensimetro","inhalador","soporte lumbar",
      "faja ortopedica","rodillera","muñequera"
    ],
    medium: [
      "salud","bienestar","rehabilitacion"
    ],
    weak: []
  },

  "escolar y oficina": {
    strong: [
      "cuaderno","lapiz","boligrafo","marcador","papeleria",
      "agenda","carpeta","archivador","calculadora",
      "escritorio","organizador escritorio"
    ],
    medium: [
      "escolar","oficina","estudio"
    ],
    weak: []
  },

  "vehiculos y herramientas": {
    strong: [
      "destornillador","llave inglesa","taladro",
      "repuesto","faro","bateria coche",
      "inflador llantas","gato hidraulico",
      "kit herramientas"
    ],
    medium: [
      "herramienta","vehiculo","automotriz"
    ],
    weak: []
  },

  "viaje y equipaje": {
    strong: [
      "maleta","equipaje","bolso viaje","neceser viaje",
      "organizador viaje","mochila viaje","bolsa viaje",
      "etiqueta equipaje"
    ],
    medium: [
      "viaje","turismo"
    ],
    weak: []
  },

"fiestas y eventos": {
  strong: [
    "cumpleanos","fiesta","fiestas","globos","decoracion fiesta",
    "graduacion","bodas","boda","baby shower","navidad",
    "halloween","san valentin","decoracion cumpleaños",
    "velas cumpleaños","banderines","banner fiesta"
  ],
  medium: [
    "celebracion","evento","regalo fiesta"
  ],
  weak: []
},

"jardin y exterior": {
  strong: [
    "jardin","plantas","maceta","macetas","riego",
    "herramienta jardin","regadera","semillas",
    "decoracion jardin","luces jardin","farol jardin"
  ],
  medium: [
    "exterior","patio","terraza"
  ],
  weak: []
},

"bolsos y accesorios": {
  strong: [
    "bolso","mochila","cartera","monedero",
    "bandolera","riñonera","bolso mano","bolso mujer",
    "bolso hombro"
  ],
  medium: [
    "accesorio bolso","organizador bolso"
  ],
  weak: []
},


"bebe": {
  strong: [
    "biberon",
    "chupete",
    "babero",
    "carriola",
    "portabebe",
    "cuna",
    "mordedor"
  ],
  medium: [
    "infantil",
    "recien nacido",
    "para bebe",
    "ropa bebe"
  ],
  weak: []
},


};

/**
 * Retorna la categoría más probable por keywords
 */
export function findBestCategory(text, categories) {

  if (!text) return null;

  const normalized = normalizeText(text);
  const tokensRaw = tokenize(normalized);

  // 🔹 palabras irrelevantes que no ayudan a clasificar
 const ignoredTokens = [
  "color","modelo","estilo","nuevo","original",
  "rosa","azul","verde","negro","blanco", "composicion",
  "multicolor","material","tamaño","tipo",
  "clasico","moderno","simple","basico",
  "pieza","piezas","set","kit","pack"
];

  const tokens = tokensRaw.filter(t => !ignoredTokens.includes(t));
  const fullText = tokens.join(" ");

  
  let best = null;

  for (const cat of categories) {

    const profile = categoryKeywords[cat.name.toLowerCase()];
    if (!profile) continue;

    const { strong = [], medium = [], weak = [] } = profile;

    let score = 0;
    let strongMatches = 0;
    let mediumMatches = 0;

    // 🔹 detectar frases completas primero
    for (const kw of strong) {

     if (fullText.includes(kw)) {

      
        score += 8;
        strongMatches++;

      }

    }

    for (const token of tokens) {

      if (strong.includes(token)) {

        score += 6;
        strongMatches++;

      }

      else if (medium.includes(token)) {

        score += 3;
        mediumMatches++;

      }

      else if (weak.includes(token)) {

        score += 1;

      }

    }

    // 🔴 ignorar coincidencias débiles
    if (strongMatches === 0 && mediumMatches === 0) {
      continue;
    }

    const confidence = tokens.length ? score / tokens.length : 0;


    if (!best || confidence > best.confidence) {

      best = {
        id: cat.id,
        name: cat.name,
        score,
        confidence,
        strongMatches,
        mediumMatches
      };

    }

  }

  if (!best) {
  return null;
}
  // 🔴 mínimo de confianza
  if (best.confidence < 0.3) {
    return null;
  }

  return best;

}