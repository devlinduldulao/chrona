import { createFieldComponents, useField, type FieldProps } from "./field";

export type TimeFieldProps = FieldProps<"time">;
export const TimeField = createFieldComponents("time");
export function useTimeField(props: TimeFieldProps = {}) { return useField("time", props); }