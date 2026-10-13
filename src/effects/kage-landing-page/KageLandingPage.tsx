import { useCallback } from "react";

import { LandingPageFrame, type LandingPageProps } from "../../shaders/landing-pages/LandingPageFrame";
import { KAGE_TYPOGRAPHY } from "../../shaders/landing-pages/pageRecipes";
import {
  splitTypographyProps,
  usePageTypography,
  type PageTypographyProps,
} from "../../shaders/landing-pages/pageTypography";
import { prepareFrame } from "./frameBridge";

export const KAGE_SOURCE_URL = `${import.meta.env.BASE_URL}landing-pages/kage.html`;
export const KAGE_TITLE = "Kage — Where stillness reveals the unseen";

export type KageLandingPageProps = LandingPageProps &
  PageTypographyProps & {
    /** Document to load inside the frame. Defaults to the byte-exact Kage page. */
    sourceUrl?: string;
    /** Accessible name of the frame. */
    title?: string;
  };

/**
 * The registered ThreeUI host: typography and colour props become one stylesheet appended to the
 * loaded document's head, so the HTML on disk is never rewritten.
 */
export function KageLandingPage({
  sourceUrl = KAGE_SOURCE_URL,
  title = KAGE_TITLE,
  applyScene,
  ...props
}: KageLandingPageProps) {
  const [type, frame] = splitTypographyProps(props);
  const customization = usePageTypography(KAGE_TYPOGRAPHY, type);

  const handleScene = useCallback(
    (element: HTMLIFrameElement) => {
      prepareFrame(element);
      applyScene?.(element);
    },
    [applyScene],
  );

  return (
    <LandingPageFrame
      {...frame}
      customization={customization}
      title={title}
      sourceUrl={sourceUrl}
      applyScene={handleScene}
    />
  );
}
