import { z } from "zod";

export const eventSchema = z.object({
  name: z.string().min(2).max(120),
  starts_at: z.coerce.date(),
  location: z.string().optional(),
  status: z.enum(["draft", "published", "done"]),
});

export type EventInput = z.infer<typeof eventSchema>;
