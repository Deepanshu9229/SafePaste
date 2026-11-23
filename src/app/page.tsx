import Editor from "@/features/editor/Editor";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold">SafePaste</h1>
        <p className="text-muted-foreground">
          Mask personal data before you paste it into AI, then restore it in the reply.
        </p>
      </header>
      <Editor />
    </main>
  );
}
