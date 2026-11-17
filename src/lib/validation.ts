import { z } from "zod";

const phoneSchema = z.string().trim().regex(/^\d{10}$/, "मोबाइल नंबर 10 अंकों का होना चाहिए।");
const pincodeSchema = z.string().trim().regex(/^\d{6}$/, "पिनकोड 6 अंकों का होना चाहिए।");

export const LeadInputSchema = z.object({
  farmerName: z.string().trim().min(2).max(100),
  phone: phoneSchema,
  product: z.string().trim().min(2).max(100),
  quantity: z.string().trim().min(1).max(50),
  village: z.string().trim().min(2).max(120),
  pincode: pincodeSchema,
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  adSource: z.string().trim().max(120).optional().default("organic"),
}).refine((value) => (value.lat == null) === (value.lng == null), {
  message: "लोकेशन अधूरी है।",
  path: ["lat"],
});

export const RetailerInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  type: z.enum(["retailer", "distributor"]),
  village: z.string().trim().min(1).max(120),
  district: z.string().trim().min(1).max(100),
  pincode: pincodeSchema,
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  active: z.boolean().default(true),
}).refine((value) => (value.lat == null) === (value.lng == null), {
  message: "Latitude और longitude दोनों दें या दोनों खाली छोड़ें।",
  path: ["lat"],
});

export const PincodeInputSchema = z.object({
  pincode: pincodeSchema,
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  district: z.string().trim().max(100).optional().default(""),
});

export const LeadUpdateSchema = z.object({
  leadId: z.string().uuid(),
  status: z.enum(["new", "sent", "contacted", "delivered", "no_response"]).optional(),
  notes: z.string().max(2000).optional(),
  retailerId: z.string().uuid().nullable().optional(),
});
