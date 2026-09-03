import {
  Schema,
  model,
} from "mongoose";

export type StoreOrderMode =
  | "automatic"
  | "open"
  | "paused";

export interface StoreSettingsDocument {
  _id: string;
  orderMode: StoreOrderMode;
  inventoryTrackingEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const storeSettingsSchema =
  new Schema<StoreSettingsDocument>(
    {
      _id: {
        type: String,
        default: "main",
      },

      orderMode: {
        type: String,
        enum: [
          "automatic",
          "open",
          "paused",
        ],
        default: "automatic",
        required: true,
      },

      inventoryTrackingEnabled: {
        type: Boolean,
        default: false,
        required: true,
      },
    },
    {
      timestamps: true,
    },
  );

export const StoreSettings =
  model<StoreSettingsDocument>(
    "StoreSettings",
    storeSettingsSchema,
  );
