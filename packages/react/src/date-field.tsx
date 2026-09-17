import { createFieldComponents, useField, type FieldProps } from "./field";

export type DateFieldProps = FieldProps<"date">;
export const DateField = createFieldComponents("date");
export function useDateField(props: DateFieldProps = {}) { return useField("date", props); }