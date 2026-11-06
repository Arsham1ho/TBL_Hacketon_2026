import text from "@/content/approved-text.json";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold">SafeStep</h1>
      <p className="mt-4 text-sm text-gray-600">{text.prototypeNotice.en}</p>
    </main>
  );
}
