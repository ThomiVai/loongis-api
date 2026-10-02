import assert from "node:assert/strict";
import test from "node:test";
import { getComboConfiguration } from "./comboConfiguration";

test("Gula permite dos elecciones dobles independientes y sin bebida", () => {
  const combo = getComboConfiguration(101);
  assert.equal(combo.name, "Combo Gula");
  assert.deepEqual(combo.choiceGroups.map((group) => group.id), ["hamburguesa-1", "hamburguesa-2"]);
  for (const group of combo.choiceGroups) {
    assert.deepEqual(group.options.map((option) => option.productLegacyId), [2, 3, 4]);
    assert.ok(group.options.every((option) => option.sizeId === "doble" && option.kind === "burger"));
  }
  combo.choiceGroups[0].options[0].ingredients.pop();
  assert.ok(combo.choiceGroups[1].options[0].ingredients.includes("Pickles"));
  assert.equal("price" in combo, false);
});

test("Tranka registra dos doble queso y permite quitar queso por hamburguesa", () => {
  const combo = getComboConfiguration(110);
  assert.equal(combo.name, "Combo Tranka");
  assert.equal(combo.choiceGroups.length, 2);
  for (const group of combo.choiceGroups) {
    assert.equal(group.options.length, 1);
    assert.equal(group.options[0].productLegacyId, 1);
    assert.equal(group.options[0].sizeId, "doble");
    assert.deepEqual(group.options[0].ingredients, ["Queso"]);
  }
  assert.equal("price" in combo, false);
});
