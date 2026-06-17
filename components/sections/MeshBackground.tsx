export default function MeshBackground() {
  return (
    <div className="mesh-bg" aria-hidden="true">
      <div
        className="mesh-blob w-[500px] h-[500px] bg-[#ddb7ff]"
        style={{ top: "-10%", left: "-10%" }}
      />
      <div
        className="mesh-blob w-[600px] h-[600px] bg-[#4cd7f6]"
        style={{ top: "20%", right: "-20%", animationDelay: "-5s" }}
      />
      <div
        className="mesh-blob w-[400px] h-[400px] bg-[#0566d9]"
        style={{ bottom: "-10%", left: "30%", animationDelay: "-10s" }}
      />
    </div>
  );
}
