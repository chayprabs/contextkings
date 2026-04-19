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
    Grid: {
      props: z.object({
        variant: z.enum(["split", "triptych"]).default("split"),
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
    AnalyticsDeck: {
      props: z.object({
        title: z.string(),
        summary: z.string(),
        status: z.string(),
        headlineLabel: z.string(),
        headlineValue: z.string(),
        deltaLabel: z.string(),
        deltaTone: z.enum(["positive", "neutral", "warning"]),
        trend: z.array(
          z.object({
            label: z.string(),
            value: z.number(),
          }),
        ),
        progress: z.array(
          z.object({
            label: z.string(),
            value: z.number(),
            note: z.string(),
          }),
        ),
        distributionTitle: z.string(),
        distribution: z.array(
          z.object({
            label: z.string(),
            value: z.number(),
            note: z.string().optional(),
          }),
        ),
        leaderboardTitle: z.string(),
        leaderboard: z.array(
          z.object({
            label: z.string(),
            value: z.number(),
            note: z.string().optional(),
          }),
        ),
        notes: z.array(z.string()),
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
