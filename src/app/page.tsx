import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MaskedOutput from "@/features/editor/MaskedOutput";
import PasteInput from "@/features/editor/PasteInput";
import RestorePanel from "@/features/editor/RestorePanel";
import ReviewPanel from "@/features/editor/ReviewPanel";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 py-8 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold">SafePaste</h1>
        <p className="text-muted-foreground">
          Mask personal data before you paste it into AI, then restore it in the reply.
        </p>
      </header>
      <Tabs defaultValue="mask" className="gap-4">
        <TabsList>
          <TabsTrigger value="mask">Mask</TabsTrigger>
          <TabsTrigger value="restore">Restore</TabsTrigger>
        </TabsList>
        <TabsContent value="mask" className="grid gap-4 lg:grid-cols-3">
          <PasteInput />
          <ReviewPanel />
          <MaskedOutput />
        </TabsContent>
        <TabsContent value="restore" className="grid gap-4 lg:grid-cols-2">
          <RestorePanel />
        </TabsContent>
      </Tabs>
    </main>
  );
}
