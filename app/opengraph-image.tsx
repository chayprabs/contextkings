import { ImageResponse } from "next/og";
import { SeoSocialImage, socialImageSize } from "@/lib/seo-image";
import { siteConfig } from "@/lib/seo";

export const alt = siteConfig.socialImageAlt;
export const size = socialImageSize;
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<SeoSocialImage />, {
    ...size,
  });
}
