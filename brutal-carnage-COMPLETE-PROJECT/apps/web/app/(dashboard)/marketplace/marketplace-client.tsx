// app/(dashboard)/marketplace/marketplace-client.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, Loader2, MessageCircle, Crown, Tag, CheckCircle2, Ban } from "lucide-react";
import { RankBadge } from "@/components/layout/rank-badge";
import { Rank } from "@prisma/client";

interface Listing {
  id: string;
  itemName: string;
  description: string | null;
  askingPrice: number;
  quantity: number;
  isFamilyStock: boolean;
  createdAt: string;
  seller: { id: string; username: string; discordId: string; rank: Rank };
  linkedItem: { id: string; name: string; currentStock: number } | null;
}

interface FamilyItemOption {
  id: string;
  name: string;
  currentStock: number;
}

export function MarketplaceClient({
  listings,
  currentUserId,
  canListFamilyStock,
  familyItems,
}: {
  listings: Listing[];
  currentUserId: string;
  canListFamilyStock: boolean;
  familyItems: FamilyItemOption[];
}) {
  const [tab, setTab] = useState<"member" | "family">("member");
  const [showForm, setShowForm] = useState(false);

  const memberListings = useMemo(() => listings.filter((l) => !l.isFamilyStock), [listings]);
  const familyListings = useMemo(() => listings.filter((l) => l.isFamilyStock), [listings]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl tracking-wide text-zinc-100">Marketplace</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Post items you want to sell. Buyers contact sellers on Discord to negotiate.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-md bg-gradient-to-r from-red-800 to-red-700 px-4 py-2 text-sm font-medium text-zinc-100 shadow-[0_0_18px_-4px_rgba(220,38,38,0.5)] hover:shadow-[0_0_24px_-2px_rgba(220,38,38,0.7)]"
        >
          <Plus className="h-4 w-4" /> List an item
        </button>
      </div>

      <div className="mb-5 flex gap-1 rounded-lg border border-panel-border bg-panel/70 p-1 text-sm">
        <button
          onClick={() => setTab("member")}
          className={`flex-1 rounded-md py-2 transition ${
            tab === "member" ? "bg-red-950/50 text-red-200" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          Member marketplace ({memberListings.length})
        </button>
        <button
          onClick={() => setTab("family")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 transition ${
            tab === "family" ? "bg-amber-950/50 text-amber-200" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Crown className="h-3.5 w-3.5" /> Family inventory for sale ({familyListings.length})
        </button>
      </div>

      {tab === "member" ? (
        <ListingGrid listings={memberListings} currentUserId={currentUserId} canManageAny={canListFamilyStock} empty="No members are selling anything right now." />
      ) : (
        <ListingGrid listings={familyListings} currentUserId={currentUserId} canManageAny={canListFamilyStock} empty="Leadership hasn't listed any family inventory for sale." />
      )}

      {showForm && (
        <ListingForm
          onClose={() => setShowForm(false)}
          canListFamilyStock={canListFamilyStock}
          familyItems={familyItems}
          defaultFamilyStock={tab === "family"}
        />
      )}
    </div>
  );
}

function ListingGrid({
  listings,
  currentUserId,
  canManageAny,
  empty,
}: {
  listings: Listing[];
  currentUserId: string;
  canManageAny: boolean;
  empty: string;
}) {
  if (listings.length === 0) {
    return <p className="text-sm text-zinc-600">{empty}</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {listings.map((l) => (
        <ListingCard key={l.id} listing={l} canManage={canManageAny || l.seller.id === currentUserId} />
      ))}
    </div>
  );
}

function ListingCard({ listing, canManage }: { listing: Listing; canManage: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function updateStatus(status: "SOLD" | "CANCELLED") {
    setBusy(true);
    try {
      const res = await fetch(`/api/marketplace/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success(status === "SOLD" ? "Marked as sold" : "Listing cancelled");
      router.refresh();
    } catch {
      toast.error("Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 ${
        listing.isFamilyStock ? "border-amber-900/50 bg-amber-950/10" : "border-panel-border bg-panel/70"
      }`}
    >
      <div>
        <div className="mb-1 flex items-center gap-2">
          {listing.isFamilyStock && <Crown className="h-3.5 w-3.5 text-amber-400" />}
          <h3 className="text-sm font-medium text-zinc-100">{listing.itemName}</h3>
        </div>
        {listing.description && <p className="text-xs text-zinc-500">{listing.description}</p>}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1 text-zinc-400">
          <Tag className="h-3.5 w-3.5" /> ${listing.askingPrice.toLocaleString()}
        </span>
        <span className="text-xs text-zinc-500">× {listing.quantity}</span>
      </div>

      <div className="flex items-center justify-between border-t border-panel-border pt-3">
        <div>
          <p className="text-xs text-zinc-500">Seller</p>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-xs text-zinc-300">{listing.seller.username}</span>
            <RankBadge rank={listing.seller.rank} />
          </div>
        </div>
        <a
          href={`https://discord.com/users/${listing.seller.discordId}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-md border border-panel-border px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/[0.04]"
        >
          <MessageCircle className="h-3.5 w-3.5" /> Contact to negotiate
        </a>
      </div>
      <p className="text-[11px] text-zinc-600">Discord: {listing.seller.discordId}</p>

      {canManage && (
        <div className="flex gap-2 border-t border-panel-border pt-3">
          <button
            onClick={() => updateStatus("SOLD")}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-green-800 bg-green-950/40 py-1.5 text-xs text-green-300 hover:bg-green-950/60 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Mark sold
          </button>
          <button
            onClick={() => updateStatus("CANCELLED")}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1 rounded-md border border-red-900 bg-red-950/40 py-1.5 text-xs text-red-300 hover:bg-red-950/60 disabled:opacity-50"
          >
            <Ban className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function ListingForm({
  onClose,
  canListFamilyStock,
  familyItems,
  defaultFamilyStock,
}: {
  onClose: () => void;
  canListFamilyStock: boolean;
  familyItems: FamilyItemOption[];
  defaultFamilyStock: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [isFamilyStock, setIsFamilyStock] = useState(defaultFamilyStock && canListFamilyStock);
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [askingPrice, setAskingPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [linkedItemId, setLinkedItemId] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemName.trim() || !askingPrice) {
      toast.error("Item name and asking price are required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: itemName.trim(),
          description: description.trim() || undefined,
          askingPrice: Number(askingPrice),
          quantity: Number(quantity) || 1,
          isFamilyStock,
          linkedItemId: isFamilyStock && linkedItemId ? linkedItemId : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Request failed");
      }
      toast.success("Listing posted");
      router.refresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't post listing");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-lg border border-panel-border bg-panel p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg tracking-wide text-zinc-100">List an item for sale</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {canListFamilyStock && (
            <label className="flex items-center gap-2 rounded-md border border-amber-900/50 bg-amber-950/10 p-3 text-sm text-amber-200">
              <input
                type="checkbox"
                checked={isFamilyStock}
                onChange={(e) => setIsFamilyStock(e.target.checked)}
                className="h-4 w-4 rounded border-panel-border bg-white/[0.03]"
              />
              List this from the family inventory (Deputy+/Boss/Big Boss only)
            </label>
          )}

          {isFamilyStock && (
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Link to a catalog item (optional)</label>
              <select
                value={linkedItemId}
                onChange={(e) => {
                  setLinkedItemId(e.target.value);
                  const found = familyItems.find((i) => i.id === e.target.value);
                  if (found) setItemName(found.name);
                }}
                className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-700"
              >
                <option value="">None — custom listing</option>
                {familyItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.currentStock} in stock)
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-zinc-600">Linking auto-deducts stock when marked sold.</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Item name</label>
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Weaponized Tampa"
              className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-700"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Condition, extras, pickup details…"
              className="w-full resize-none rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Asking price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={askingPrice}
                  onChange={(e) => setAskingPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-md border border-panel-border bg-white/[0.03] py-2 pl-7 pr-3 text-sm text-zinc-100 outline-none focus:border-red-700"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-zinc-500">Quantity</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-md border border-panel-border bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 outline-none focus:border-red-700"
              />
            </div>
          </div>

          <p className="text-xs text-zinc-600">
            Your Discord ID will be shown so buyers can contact you directly to negotiate a price.
          </p>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-panel-border py-2 text-sm text-zinc-400 hover:bg-white/[0.04]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-red-800 to-red-700 py-2 text-sm font-medium text-zinc-100 shadow-[0_0_20px_-4px_rgba(220,38,38,0.5)] transition hover:shadow-[0_0_28px_-2px_rgba(220,38,38,0.7)] disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Post listing
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
