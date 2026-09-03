import type {
  ProductChoiceGroup,
  ProductChoiceOption,
} from "../models/product.model";

export const BURGER_CHOICE_IDS = [
  "solo-queso",
  "clasic",
  "bacon",
  "crispy",
] as const;

export type BurgerChoiceId =
  (typeof BURGER_CHOICE_IDS)[number];

type BurgerChoiceDefinition = {
  id: BurgerChoiceId;
  label: string;
  productLegacyId: number;
  ingredients: string[];
  comboImage: string;
  comboImageAlt: string;
};

const burgerChoiceDefinitions:
  Record<
    BurgerChoiceId,
    BurgerChoiceDefinition
  > = {
  "solo-queso": {
    id: "solo-queso",
    label: "Solo Queso",
    productLegacyId: 1,
    ingredients: ["Queso"],
    comboImage:
      "/images/burgers/combo-simplequeso.png",
    comboImageAlt:
      "Combo del Día con hamburguesa Solo Queso, papas y bebida",
  },
  clasic: {
    id: "clasic",
    label: "Loongis Clasic",
    productLegacyId: 2,
    ingredients: [
      "Queso",
      "Lechuga",
      "Tomate",
      "Cebolla morada",
      "Salsa Loongis",
      "Pickles",
    ],
    comboImage:
      "/images/burgers/combo-promo.png",
    comboImageAlt:
      "Combo del Día con Loongis Clasic, papas y bebida",
  },
  bacon: {
    id: "bacon",
    label: "Loongis Bacon",
    productLegacyId: 3,
    ingredients: [
      "Queso",
      "Bacon",
      "Salsa especial",
    ],
    comboImage:
      "/images/burgers/combo-bacon.png",
    comboImageAlt:
      "Combo del Día con Loongis Bacon, papas y bebida",
  },
  crispy: {
    id: "crispy",
    label: "Loongis Crispy",
    productLegacyId: 4,
    ingredients: [
      "Queso",
      "Cebolla crispy",
      "Bacon",
      "Salsa de mostaza dulce",
    ],
    comboImage:
      "/images/burgers/combo-crispy.png",
    comboImageAlt:
      "Combo del Día con Loongis Crispy, papas y bebida",
  },
};

export function isBurgerChoiceId(
  value: unknown,
): value is BurgerChoiceId {
  return (
    typeof value === "string" &&
    BURGER_CHOICE_IDS.some(
      (candidate) => candidate === value,
    )
  );
}

export function createBurgerChoice(
  id: BurgerChoiceId,
  sizeId: "simple" | "doble",
): ProductChoiceOption {
  const definition =
    burgerChoiceDefinitions[id];

  return {
    id: definition.id,
    label: definition.label,
    productLegacyId:
      definition.productLegacyId,
    kind: "burger",
    sizeId,
    ingredients: [
      ...definition.ingredients,
    ],
  };
}

export function getDailyComboPresentation(
  burgerId: BurgerChoiceId,
): {
  image: string;
  imageAlt: string;
} {
  const definition =
    burgerChoiceDefinitions[burgerId];

  return {
    image: definition.comboImage,
    imageAlt:
      definition.comboImageAlt,
  };
}

export function createDailyComboChoiceGroups(
  burgerId: BurgerChoiceId,
): ProductChoiceGroup[] {
  return [
    {
      id: "hamburguesa-del-dia",
      label: "Hamburguesa del día",
      options: [
        createBurgerChoice(
          burgerId,
          "doble",
        ),
      ],
    },
    {
      id: "bebida",
      label: "Elegí tu bebida",
      options: [
        "Coca-Cola",
        "Pepsi",
        "Sprite",
        "Agua",
      ].map((label) => ({
        id: label
          .toLowerCase()
          .normalize("NFD")
          .replace(
            /[\u0300-\u036f]/g,
            "",
          )
          .replace(
            /[^a-z0-9]+/g,
            "-",
          )
          .replace(
            /^-+|-+$/g,
            "",
          ),
        label,
        kind: "beverage" as const,
        ingredients: [],
      })),
    },
  ];
}
