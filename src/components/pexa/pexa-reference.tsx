"use client";

/**
 * Reference notes for the PEXA simulator.
 *
 * Written for VAs in our own words — the terminology, roles, statuses and fee
 * structure a trainee needs in order to work a workspace. Figures are marked
 * as indicative because fees change: the point is that a VA knows which fee is
 * which and where to read the real number, not that they memorise an amount.
 */

import { ArrowLeft, ExternalLink, Info, TriangleAlert } from "lucide-react";
import { PEXA_FEE_NSW_FINANCIAL } from "@/lib/pexa/seed";
import { formatMoney, usePexa } from "@/lib/pexa/store";
import { PEXA_JURISDICTIONS } from "@/lib/pexa/types";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-[#dbe5ed] bg-white">
      <div className="border-b border-[#e6edf3] px-3.5 py-2.5">
        <h3 className="text-[13px] font-semibold text-[#12263a]">{title}</h3>
      </div>
      <div className="px-3.5 py-3 text-[12px] leading-relaxed text-[#33475b]">{children}</div>
    </section>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-[#eef3f7] py-2 last:border-b-0 sm:grid-cols-[190px_1fr] sm:gap-3">
      <span className="font-semibold text-[#12263a]">{term}</span>
      <span>{children}</span>
    </div>
  );
}

export function PexaReference() {
  const { dispatch } = usePexa();

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[#f2f6f9] p-4">
      <div className="mx-auto grid max-w-[820px] gap-4">
        <button
          type="button"
          onClick={() => dispatch({ type: "CLOSE_WORKSPACE" })}
          className="inline-flex w-fit items-center gap-1 text-[12px] text-[#00838f] hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to workspaces
        </button>

        <div className="rounded-lg border border-[#f0d8a8] bg-[#fdf6e3] p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-[#7a5c10]">
            <TriangleAlert className="size-3.5" />
            Read this first
          </div>
          <p className="text-[12px] leading-relaxed text-[#7a5c10]">
            These are training notes, not advice, and this simulator is not PEXA. Dollar figures
            below are indicative and change — never quote a fee from memory. Read the real number
            off the workspace fee schedule or the current published pricing for the jurisdiction
            you are in.
          </p>
        </div>

        <Section title="What PEXA is">
          <p>
            PEXA is an Electronic Lodgement Network. Instead of a physical settlement where cheques
            and paper titles change hands across a table, the transaction happens in an online
            workspace: funds move and the registry documents lodge at the same moment.
          </p>
          <p className="mt-2">
            That simultaneity is the whole point. The vendor gets paid as title passes, so neither
            side has to trust the other to do their half afterwards.
          </p>
        </Section>

        <Section title="The products you may hear named">
          <Row term="Exchange">
            The settlement platform itself — workspaces, documents, funds. This is what the
            simulator replicates and where your work happens.
          </Row>
          <Row term="Key">
            A mobile app used to communicate with clients during a transaction.
          </Row>
          <Row term="Projects">Used for large developments settling many lots.</Row>
          <Row term="Planner">A tool aimed at financial institutions.</Row>
          <Row term="Tracker">A dashboard view of transactions in progress.</Row>
          <p className="mt-2 text-[#5b7286]">
            For conveyancing support work, Exchange is the one that matters.
          </p>
        </Section>

        <Section title="Workspace roles">
          <p className="mb-2">
            Your role decides which documents you can create and sign. Getting it wrong is a common
            and expensive mistake, because it is usually discovered close to settlement.
          </p>
          <Row term="Incoming Proprietor">
            You act for the buyer. You prepare and sign the Transfer.
          </Row>
          <Row term="Proprietor on Title">
            You act for the seller — the current registered owner.
          </Row>
          <Row term="Incoming Mortgagee">
            The <em>new</em> lender advancing funds. They prepare and sign the new mortgage.
          </Row>
          <Row term="Mortgagee on Title">
            The <em>existing</em> lender being paid out. They sign the discharge.
          </Row>
          <p className="mt-2">
            The two mortgagee roles are the ones people mix up. Incoming is the bank lending;
            on-title is the bank being repaid.
          </p>
        </Section>

        <Section title="The two status bars">
          <p className="mb-2">
            A workspace tracks readiness in two independent tracks, and both must reach Ready — what
            practitioners call &ldquo;Ready/Ready&rdquo; — before it can settle.
          </p>
          <Row term="Lodgement">
            In Preparation → Prepared → Ready. Ready once every registry document has been signed by
            whoever is responsible for it.
          </Row>
          <Row term="Financial Settlement">
            Ready only once the Financial Settlement Schedule balances. A workspace with no money
            moving has no financial settlement at all.
          </Row>
          <p className="mt-2">
            One bar being green tells you nothing on its own. Always check both before telling
            anyone a settlement is on track.
          </p>
        </Section>

        <Section title="The Financial Settlement Schedule">
          <p>
            The schedule has two sides. <strong>Source</strong> funds are money coming in — the
            purchaser&apos;s funds, an incoming mortgage advance, released deposit.{" "}
            <strong>Destination</strong> line items are where it goes — discharging the existing
            mortgage, rates and water adjustments, agent&apos;s commission, duty, fees, and the
            balance to the vendor.
          </p>
          <p className="mt-2">
            The two sides must match <strong>to the cent</strong>. If they do not, settlement does
            not proceed — and a failed settlement can put your client in breach, attract penalty
            interest, and force a rebooking around the other side and their bank. This is why the
            schedule is checked days before, not on the morning.
          </p>
        </Section>

        <Section title="Three different amounts people call &ldquo;the fee&rdquo;">
          <Row term="PEXA transaction fee">
            Charged by PEXA for using the platform, and only on successful lodgement. Published
            GST-inclusive. Differs by transaction type — a transfer with financial settlement costs
            more than a lodgement-only transfer.
          </Row>
          <Row term="Lodgement fee">
            A statutory fee set by the state Land Registry, not by PEXA. It changes on its own
            schedule, usually annually.
          </Row>
          <Row term="Duty">
            Transfer duty payable to the state revenue office. Not a PEXA charge at all — it is a
            tax, and by far the largest of the three.
          </Row>
          <div className="mt-3 rounded-md border border-[#dbe5ed] bg-[#f7fbfd] p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-[#12263a]">
              <Info className="size-3.5 text-[#00838f]" />
              Figure used in this simulator
            </div>
            <p className="text-[11px] text-[#33475b]">
              NSW transfer with financial settlement, single title:{" "}
              <strong>{formatMoney(PEXA_FEE_NSW_FINANCIAL)}</strong> including GST, per PEXA&apos;s
              published NSW pricing effective 1 July 2026. Other jurisdictions and transaction
              types differ. Check the current schedule rather than reusing this number.
            </p>
          </div>
        </Section>

        <Section title="Settlement dates">
          <p>
            Whoever creates the workspace proposes a date and time; every other participant has to
            accept it. Until they all have, it is not booked — a workspace with no agreed date shows
            as <strong>Ready to Book</strong>.
          </p>
          <p className="mt-2">
            Proposing a new date <strong>clears every acceptance already given</strong>. On a matter
            with a discharging bank and an incoming lender, re-gathering those can take more than a
            day, so never re-propose without warning the other participants first.
          </p>
        </Section>

        <Section title="Signing">
          <p>
            You sign on your client&apos;s behalf under a signed Client Authorisation, and only
            after their identity has been verified. A signing certificate is personal to the holder
            — sharing one, or signing under someone else&apos;s login, is a serious breach, not a
            shortcut when someone is on leave.
          </p>
        </Section>

        <Section title="Jurisdictions">
          <p>
            Each state and territory has its own land registry, forms and requirements:{" "}
            {PEXA_JURISDICTIONS.join(", ")}. A workspace created in the wrong jurisdiction cannot
            lodge against the title, and the work has to be redone in a new one — so confirm it
            before you start.
          </p>
        </Section>

        <Section title="Where the real answers live">
          <p>
            When something in a live workspace does not match these notes, the product&apos;s own
            help centre and the current jurisdictional pricing are authoritative — these notes are
            not.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[#00838f]">
            <ExternalLink className="size-3.5" />
            help.pexa.com.au · pexa.com.au/pricing
          </p>
        </Section>
      </div>
    </div>
  );
}
