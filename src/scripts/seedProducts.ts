import "dotenv/config";

import mongoose from "mongoose";

import { connectDatabase } from "../config/database";
import { Category } from "../models/category.model";
import {
  Product,
  type ProductOption,
} from "../models/product.model";

/* ========================================
   OPCIONES DE HAMBURGUESAS
======================================== */

const hamburgerSizes: ProductOption[] = [
  {
    id: "simple",
    name: "Simple",
    label: "Simple",
    priceModifier: -1800,
  },
  {
    id: "doble",
    name: "Doble",
    label: "Doble",
    priceModifier: 0,
  },
  {
    id: "triple",
    name: "Triple",
    label: "Triple",
    priceModifier: 2200,
  },
];

/* ========================================
   EXTRAS
======================================== */

const hamburgerExtras: ProductOption[] = [
  {
    id: "cheddar",
    name: "Cheddar extra",
    label: "Cheddar extra",
    priceModifier: 700,
  },
  {
    id: "bacon",
    name: "Bacon extra",
    label: "Bacon extra",
    priceModifier: 1200,
  },
  {
    id: "huevo",
    name: "Huevo",
    label: "Huevo",
    priceModifier: 900,
  },
  {
    id: "medallon",
    name: "Medallón extra",
    label: "Medallón extra",
    priceModifier: 1800,
  },
];

/* ========================================
   CATEGORÍAS
======================================== */

async function seedCategories() {
  console.log(
    "Verificando categorías...",
  );

  const hamburgerCategory =
    await Category.findOneAndUpdate(
      {
        slug: "hamburguesas",
      },
      {
        $set: {
          name: "Hamburguesas",
          slug: "hamburguesas",
          active: true,
          order: 1,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

  console.log(
    "✓ Hamburguesas",
  );

  const comboCategory =
    await Category.findOneAndUpdate(
      {
        slug: "combos",
      },
      {
        $set: {
          name: "Combos",
          slug: "combos",
          active: true,
          order: 2,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

  console.log(
    "✓ Combos",
  );

  return {
    hamburgerCategory,
    comboCategory,
  };
}

/* ========================================
   PRODUCTOS
======================================== */

async function seedProducts(): Promise<void> {
  try {
    await connectDatabase();

    console.log("");
    console.log(
      "Inicializando base de datos de Loongis...",
    );
    console.log("");

    /* =====================================
       CATEGORÍAS
    ===================================== */

    const {
      hamburgerCategory,
      comboCategory,
    } = await seedCategories();

    console.log("");
    console.log(
      "Cargando catálogo...",
    );

    /* =====================================
       CATÁLOGO
    ===================================== */

    const products = [
      {
        legacyId: 1,

        name: "Simple Queso",

        slug: "simple-queso",

        description:
          "Medallón smash y doble queso.",

        price: 9500,

        image:
          "/images/burgers/simple-queso.png",

        imageAlt:
          "Hamburguesa Simple Queso con medallón smash y doble queso",

        category:
          hamburgerCategory._id,

        featured: false,
        active: true,
        order: 1,

        sizes:
          hamburgerSizes,

        extras:
          hamburgerExtras,

        ingredients: [
          "Queso",
        ],
      },

      {
        legacyId: 2,

        name: "Loongis Clasic",

        slug: "loongis-clasic",

        description:
          "Medallón smash, doble queso, lechuga, tomate, cebolla morada, salsa Loongis y pickles.",

        price: 9800,

        image:
          "/images/burgers/loongis-clasic.png",

        imageAlt:
          "Hamburguesa Loongis Clasic con doble queso, lechuga, tomate, cebolla morada, salsa Loongis y pickles",

        category:
          hamburgerCategory._id,

        featured: true,
        active: true,
        order: 2,

        sizes:
          hamburgerSizes,

        extras:
          hamburgerExtras,

        ingredients: [
          "Queso",
          "Lechuga",
          "Tomate",
          "Cebolla morada",
          "Salsa Loongis",
          "Pickles",
        ],
      },

      {
        legacyId: 3,

        name: "Loongis Bacon",

        slug: "loongis-bacon",

        description:
          "Medallón smash, doble queso, doble bacon y salsa especial.",

        price: 10900,

        image:
          "/images/burgers/loongis-bacon.png",

        imageAlt:
          "Hamburguesa Loongis Bacon con doble queso, doble bacon y salsa especial",

        category:
          hamburgerCategory._id,

        featured: true,
        active: true,
        order: 3,

        sizes:
          hamburgerSizes,

        extras:
          hamburgerExtras,

        ingredients: [
          "Queso",
          "Bacon",
          "Salsa especial",
        ],
      },

      {
        legacyId: 4,

        name: "Loongis Crispy",

        slug: "loongis-crispy",

        description:
          "Medallón smash, doble queso, cebolla crispy, bacon y salsa de mostaza dulce.",

        price: 11200,

        image:
          "/images/burgers/loongis-crispy.png",

        imageAlt:
          "Hamburguesa Loongis Crispy con doble queso, cebolla crispy, bacon y salsa de mostaza dulce",

        category:
          hamburgerCategory._id,

        featured: true,
        active: true,
        order: 4,

        sizes:
          hamburgerSizes,

        extras:
          hamburgerExtras,

        ingredients: [
          "Queso",
          "Cebolla crispy",
          "Bacon",
          "Salsa de mostaza dulce",
        ],
      },

      {
        legacyId: 101,

        name: "Combo Clásico",

        slug: "combo-clasico",

        description:
          "Loongis Clasic acompañada con papas crocantes y bebida individual.",

        price: 14500,

        image:
          "/images/burgers/combo-promo.png",

        imageAlt:
          "Combo Clásico con hamburguesa Loongis Clasic, papas y bebida",

        category:
          comboCategory._id,

        featured: false,
        active: true,
        order: 5,

        sizes:
          hamburgerSizes,

        extras:
          hamburgerExtras,

        ingredients: [
          "Queso",
          "Lechuga",
          "Tomate",
          "Cebolla morada",
          "Salsa Loongis",
          "Pickles",
        ],
      },

      {
        legacyId: 102,

        name: "Combo Bacon",

        slug: "combo-bacon",

        description:
          "Loongis Bacon acompañada con papas crocantes y bebida individual.",

        price: 15800,

        image:
          "/images/burgers/combo-bacon.png",

        imageAlt:
          "Combo Bacon con hamburguesa Loongis Bacon, papas y bebida",

        category:
          comboCategory._id,

        featured: false,
        active: true,
        order: 6,

        sizes:
          hamburgerSizes,

        extras:
          hamburgerExtras,

        ingredients: [
          "Queso",
          "Bacon",
          "Salsa especial",
        ],
      },

      {
        legacyId: 109,

        name: "Combo Crispy",

        slug: "combo-crispy",

        description:
          "Loongis Crispy acompañada con papas crocantes y bebida individual.",

        price: 16100,

        image:
          "/images/burgers/combo-crispy.png",

        imageAlt:
          "Combo Crispy con hamburguesa Loongis Crispy, papas y bebida",

        category:
          comboCategory._id,

        featured: false,
        active: true,
        order: 7,

        sizes:
          hamburgerSizes,

        extras:
          hamburgerExtras,

        ingredients: [
          "Queso",
          "Cebolla crispy",
          "Bacon",
          "Salsa de mostaza dulce",
        ],
      },

      {
        legacyId: 110,

        name:
          "Combo Simple Queso",

        slug:
          "combo-simple-queso",

        description:
          "Simple Queso acompañada con papas crocantes y bebida individual.",

        price: 14200,

        image:
          "/images/burgers/combo-simplequeso.png",

        imageAlt:
          "Combo Simple Queso con hamburguesa, papas y bebida",

        category:
          comboCategory._id,

        featured: false,
        active: true,
        order: 8,

        sizes:
          hamburgerSizes,

        extras:
          hamburgerExtras,

        ingredients: [
          "Queso",
        ],
      },
    ];

    /* =====================================
       UPSERT DE PRODUCTOS
    ===================================== */

    for (
      const product of products
    ) {
      await Product.findOneAndUpdate(
        {
          slug: product.slug,
        },
        {
          $set: product,
        },
        {
          upsert: true,
          runValidators: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      console.log(
        `✓ ${product.name}`,
      );
    }

    console.log("");
    console.log(
      "Base de datos inicializada correctamente.",
    );

    console.log(
      "2 categorías cargadas.",
    );

    console.log(
      `${products.length} productos cargados.`,
    );

    console.log("");
  } catch (error) {
    console.error("");
    console.error(
      "Error inicializando la base de datos:",
      error,
    );

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();

    console.log(
      "Conexión con MongoDB cerrada.",
    );
  }
}

void seedProducts();