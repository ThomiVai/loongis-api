import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import {
  addRecipeConsumption,
} from "./orderInventory.service";

function id():
  mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId();
}

test(
  "calcula receta base, tamaño, extra y elección",
  () => {
    const bread = id();
    const patty = id();
    const cheese = id();
    const drink = id();

    const requirements =
      new Map<string, number>();

    const hasConsumption =
      addRecipeConsumption(
        requirements,
        {
          baseItems: [
            {
              ingredient: bread,
              quantity: 1,
            },
            {
              ingredient: patty,
              quantity: 2,
            },
          ],
          sizeModifiers: [
            {
              optionId: "simple",
              items: [
                {
                  ingredient: patty,
                  quantity: -1,
                },
              ],
            },
          ],
          extraModifiers: [
            {
              optionId: "extra-cheese",
              items: [
                {
                  ingredient: cheese,
                  quantity: 1,
                },
              ],
            },
          ],
          choiceModifiers: [
            {
              groupId: "drink",
              optionId: "drink-a",
              items: [
                {
                  ingredient: drink,
                  quantity: 1,
                },
              ],
            },
          ],
        },
        {
          sizeId: "simple",
          extraIds: [
            "extra-cheese",
          ],
          choiceSelections: [
            {
              groupId: "drink",
              optionId: "drink-a",
            },
          ],
        },
        3,
      );

    assert.equal(
      hasConsumption,
      true,
    );
    assert.equal(
      requirements.get(
        bread.toString(),
      ),
      3,
    );
    assert.equal(
      requirements.get(
        patty.toString(),
      ),
      3,
    );
    assert.equal(
      requirements.get(
        cheese.toString(),
      ),
      3,
    );
    assert.equal(
      requirements.get(
        drink.toString(),
      ),
      3,
    );
  },
);

test(
  "un ingrediente removido no se descuenta",
  () => {
    const sauce = id();
    const bread = id();
    const requirements =
      new Map<string, number>();

    addRecipeConsumption(
      requirements,
      {
        baseItems: [
          {
            ingredient: bread,
            quantity: 1,
          },
          {
            ingredient: sauce,
            quantity: 20,
            removableIngredient:
              "Salsa",
          },
        ],
        sizeModifiers: [],
        extraModifiers: [],
        choiceModifiers: [],
      },
      {
        removedIngredients: [
          "Salsa",
        ],
      },
      2,
    );

    assert.equal(
      requirements.get(
        bread.toString(),
      ),
      2,
    );
    assert.equal(
      requirements.has(
        sauce.toString(),
      ),
      false,
    );
  },
);

test(
  "una elección no seleccionada no consume stock",
  () => {
    const drinkA = id();
    const drinkB = id();
    const requirements =
      new Map<string, number>();

    addRecipeConsumption(
      requirements,
      {
        baseItems: [],
        sizeModifiers: [],
        extraModifiers: [],
        choiceModifiers: [
          {
            groupId: "drink",
            optionId: "a",
            items: [
              {
                ingredient: drinkA,
                quantity: 1,
              },
            ],
          },
          {
            groupId: "drink",
            optionId: "b",
            items: [
              {
                ingredient: drinkB,
                quantity: 1,
              },
            ],
          },
        ],
      },
      {
        choiceSelections: [
          {
            groupId: "drink",
            optionId: "b",
          },
        ],
      },
      1,
    );

    assert.equal(
      requirements.has(
        drinkA.toString(),
      ),
      false,
    );
    assert.equal(
      requirements.get(
        drinkB.toString(),
      ),
      1,
    );
  },
);
