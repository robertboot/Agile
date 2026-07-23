import { PUBLIC_PRODUCTS } from "./product-pages";
import { ProductTabs } from "./ProductTabs";

export const metadata = { title: "Products" };

const LINE_PARAM: Record<string, "Membrane" | "Microlyte" | "Apis"> = {
  membrane: "Membrane",
  microlyte: "Microlyte",
  apis: "Apis",
};

export default async function PublicProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ line?: string }>;
}) {
  const { line } = await searchParams;
  const initialTab = LINE_PARAM[line?.toLowerCase() ?? ""] ?? "Membrane";
  return (
    <main>
      <section className="bg-navy-950 px-6 pb-24 pt-16 text-center">
        <h1 className="text-4xl font-bold text-white">Our Products</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-sky-100">
          Advanced wound and surgical coverings across three complementary lines — with official
          product literature for each.
        </p>
      </section>

      <div className="mx-auto -mt-14 max-w-6xl px-6 pb-20">
        <ProductTabs products={PUBLIC_PRODUCTS} initialTab={initialTab} />
      </div>
    </main>
  );
}
