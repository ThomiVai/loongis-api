import {
  Schema,
  model,
  type Types,
} from "mongoose";

/* ========================================
   TIPOS
======================================== */

export interface RecipeBaseItem {
  ingredient: Types.ObjectId;
  quantity: number;

  /*
    Si este valor coincide con uno de los
    ingredientes removibles del producto,
    el consumo de este insumo se anula
    cuando el cliente pide "Sin ...".
  */
  removableIngredient?: string;
}

export interface RecipeModifierItem {
  ingredient: Types.ObjectId;

  /*
    En tamaños puede ser positivo o negativo.
    Ejemplo:
    Simple  -> -1 medallón
    Triple  -> +1 medallón

    En extras será siempre positivo.
  */
  quantity: number;
}

export interface RecipeOptionModifier {
  optionId: string;
  items: RecipeModifierItem[];
}

export interface ProductRecipeDocument {
  product: Types.ObjectId;

  baseItems: RecipeBaseItem[];

  sizeModifiers:
    RecipeOptionModifier[];

  extraModifiers:
    RecipeOptionModifier[];

  active: boolean;
}

/* ========================================
   SUBDOCUMENTOS
======================================== */

const recipeBaseItemSchema =
  new Schema<RecipeBaseItem>(
    {
      ingredient: {
        type:
          Schema.Types.ObjectId,

        ref:
          "Ingredient",

        required:
          true,
      },

      quantity: {
        type:
          Number,

        required:
          true,

        min: [
          0.000001,
          "La cantidad debe ser mayor a cero.",
        ],
      },

      removableIngredient: {
        type:
          String,

        trim:
          true,

        default:
          undefined,
      },
    },
    {
      _id:
        false,
    },
  );

const recipeModifierItemSchema =
  new Schema<RecipeModifierItem>(
    {
      ingredient: {
        type:
          Schema.Types.ObjectId,

        ref:
          "Ingredient",

        required:
          true,
      },

      quantity: {
        type:
          Number,

        required:
          true,
      },
    },
    {
      _id:
        false,
    },
  );

const recipeOptionModifierSchema =
  new Schema<RecipeOptionModifier>(
    {
      optionId: {
        type:
          String,

        required:
          true,

        trim:
          true,
      },

      items: {
        type: [
          recipeModifierItemSchema,
        ],

        default:
          [],
      },
    },
    {
      _id:
        false,
    },
  );

/* ========================================
   RECETA
======================================== */

const productRecipeSchema =
  new Schema<ProductRecipeDocument>(
    {
      product: {
        type:
          Schema.Types.ObjectId,

        ref:
          "Product",

        required:
          true,

        unique:
          true,

        index:
          true,
      },

      baseItems: {
        type: [
          recipeBaseItemSchema,
        ],

        default:
          [],
      },

      sizeModifiers: {
        type: [
          recipeOptionModifierSchema,
        ],

        default:
          [],
      },

      extraModifiers: {
        type: [
          recipeOptionModifierSchema,
        ],

        default:
          [],
      },

      active: {
        type:
          Boolean,

        default:
          true,
      },
    },
    {
      timestamps:
        true,

      versionKey:
        false,
    },
  );

export const ProductRecipe =
  model<ProductRecipeDocument>(
    "ProductRecipe",
    productRecipeSchema,
  );
