import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MaskedOutput from "@/features/editor/MaskedOutput";
import PasteInput from "@/features/editor/PasteInput";
import RestorePanel from "@/features/editor/RestorePanel";
import ReviewPanel from "@/features/editor/ReviewPanel";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12">
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
        <TabsContent value="mask" className="flex flex-col gap-4">
          <PasteInput />
          <ReviewPanel />
          <MaskedOutput />
        </TabsContent>
        <TabsContent value="restore" className="flex flex-col gap-4">
          <RestorePanel />
        </TabsContent>
      </Tabs>
    </main>
  );
}
