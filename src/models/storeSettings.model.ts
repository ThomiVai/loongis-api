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
