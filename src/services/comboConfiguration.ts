import { createBurgerChoice, type BurgerChoiceId } from "../config/menuChoices";

export function getComboConfiguration(legacyId: 101 | 110) {
  const isGula = legacyId === 101;
  const burgers: BurgerChoiceId[] = isGula
    ? ["clasic", "bacon", "crispy"]
    : ["solo-queso"];

  return {
    name: isGula ? "Combo Gula" : "Combo Tranka",
    description: isGula
      ? "Dos hamburguesas dobles a elección: Clasic, Bacon o Crispy. Incluye una porción de papas."
      : "Dos hamburguesas dobles con queso. Incluye una porción de papas.",
    sizes: [],
    extras: [],
    ingredients: [],
    choiceGroups: [1, 2].map((number) => ({
      id: `hamburguesa-${number}`,
      label: `Hamburguesa ${number}`,
      options: burgers.map((id) => createBurgerChoice(id, "doble")),
    })),
  };
}
