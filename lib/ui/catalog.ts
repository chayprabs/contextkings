import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react/schema";
import { z } from "zod";

export const contextKingsCatalog = defineCatalog(schema, {
  components: {
    Stack: {
      props: z.object({
        gap: z.enum(["sm", "md", "lg"]).default("md"),
      }),
      slots: ["default"],
    },
    Header: {
      props: z.object({
        eyebrow: z.string().optional(),
        title: z.string(),
        description: z.string().optional(),
      }),
    },
    Notice: {
      props: z.object({
        title: z.string(),
        body: z.string(),
        tone: z.enum(["neutral", "warning", "danger"]).default("neutral"),
      }),
    },
    SectionCard: {
      props: z.object({
        title: z.string(),
        description: z.string().optional(),
      }),
      slots: ["default"],
    },
    MetricStrip: {
      props: z.object({
        items: z.array(
          z.object({
            label: z.string(),
            value: z.string(),
            hint: z.string().optional(),
          }),
        ),
      }),
    },
    PipelineTimeline: {
      props: z.object({
        steps: z.array(
          z.object({
            label: z.string(),
            status: z.enum(["done", "active", "warning"]),
            description: z.string().optional(),
          }),
        ),
      }),
    },
    TagBar: {
      props: z.object({
        title: z.string().optional(),
        tags: z.array(z.string()),
      }),
    },
    RankedList: {
      props: z.object({
        title: z.string(),
        items: z.array(
          z.object({
            label: z.string(),
            value: z.string().optional(),
            description: z.string().optional(),
          }),
        ),
      }),
    },
    RecordTable: {
      props: z.object({
        title: z.string(),
        columns: z.array(z.string()),
        rows: z.array(z.array(z.string())),
        caption: z.string().optional(),
      }),
    },
    EntityDetail: {
      props: z.object({
        title: z.string(),
        fields: z.array(
          z.object({
            label: z.string(),
            value: z.string(),
          }),
        ),
      }),
    },
    BarChart: {
      props: z.object({
        title: z.string(),
        data: z.array(
          z.object({
            label: z.string(),
            value: z.number(),
          }),
        ),
      }),
    },
    CTAGroup: {
      props: z.object({
        title: z.string(),
        buttons: z.array(
          z.object({
            label: z.string(),
            hint: z.string().optional(),
          }),
        ),
      }),
    },
  },
  actions: {},
});
