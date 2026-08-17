import AssistantChat from "@/components/assistant/chat";

export const dynamic = "force-dynamic";

export default function AssistantPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-8 py-8 h-[calc(100vh-1px)] reveal flex flex-col">
      <div className="eyebrow mb-4 shrink-0">✦ · Assistant</div>
      <div className="flex-1 min-h-0">
        <AssistantChat />
      </div>
    </div>
  );
}
