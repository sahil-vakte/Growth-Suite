import InterviewClient from "@/components/site/InterviewClient";
export const dynamic = "force-dynamic";
export default async function InterviewPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <div className="site">
      <section className="s-sec">
        <div className="s-wrap s-narrow">
          <InterviewClient token={(await params).token} />
        </div>
      </section>
    </div>
  );
}
