import {
  Schema,
  model,
} from "mongoose";

export interface CounterDocument {
  _id: string;
  sequence: number;
}

const counterSchema =
  new Schema<CounterDocument>(
    {
      _id: {
        type: String,
        required: true,
      },

      sequence: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },
    },
    {
      versionKey: false,
    },
  );

export const Counter =
  model<CounterDocument>(
    "Counter",
    counterSchema,
  );
