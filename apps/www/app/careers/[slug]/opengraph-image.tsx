import { allCareers } from "@/.content-collections/generated";
import { ImageResponse } from "@vercel/og";

export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = await params;
  const career = allCareers.find((c) => c.slug === resolvedParams.slug);

  if (!career) {
    return new ImageResponse(
      <div
        style={{
          fontSize: 60,
          background: "linear-gradient(90deg, #000 0%, #111 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
        }}
      >
        Career Not Found
      </div>,
      { ...size },
    );
  }

  return new ImageResponse(
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: 80,
        backgroundColor: "#030303",
        fontWeight: 600,
        color: "white",
      }}
    >
      <h1
        style={{
          fontSize: 72,
          margin: "0 0 35px -2px",
          padding: "0 0 5px 0",
          lineHeight: 1.1,
          textShadow: "0 2px 30px #000",
          letterSpacing: -4,
          backgroundImage: "linear-gradient(90deg, #fff 40%, #aaa)",
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
          textAlign: "left",
        }}
      >
        {career.title}
      </h1>
      <p
        style={{
          fontSize: 24,
          margin: "0 0 35px -2px",
          padding: "0 0 5px 0",
          lineHeight: 1.1,
          color: "#56534E",
          textAlign: "left",
        }}
      >
        {career.description}
      </p>

      <div
        style={{
          position: "absolute",
          bottom: 70,
          left: 80,
          margin: 0,
          fontSize: 24,
          letterSpacing: -1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p>unkey.com</p>
      </div>
    </div>,
    { ...size },
  );
}
