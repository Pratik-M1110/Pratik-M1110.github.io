import { lazy, Suspense } from "react";

// Only the React host is code-split; the HTML document is fetched by the frame from its own URL.
const KageLandingPage = lazy(() =>
  import("./effects/kage-landing-page/KageLandingPage").then((module) => ({ default: module.KageLandingPage })),
);

const PORTFOLIO_URL = `${import.meta.env.BASE_URL}landing-pages/portfolio.html`;

export default function App() {
  return (
    <main className="shader-frame">
      <Suspense fallback={<div className="shader-frame__loading" role="status">Loading</div>}>
        <KageLandingPage
          sourceUrl={PORTFOLIO_URL}
          title="Pratik Maynal — Software Developer"
          headingFont="onest"
          bodyFont="onest"
          headingWeight="400"
          bodyWeight="300"
          primaryColor="#e0231c"
          headingSize={46}
          bodySize={17}
          headingLetterSpacing={-0.012}
        />
      </Suspense>
    </main>
  );
}
