import { useState, useMemo } from "react";
import { sampleTrees } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, ArrowUpDown } from "lucide-react";

type SortKey = "Tree_ID" | "Height" | "Crown_Diameter" | "Crown_Area";

const FeaturesPage = () => {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("Tree_ID");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    let data = sampleTrees.filter((t) =>
      t.Tree_ID.toLowerCase().includes(search.toLowerCase())
    );
    data.sort((a, b) => {
      const av = a[sortBy], bv = b[sortBy];
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [search, sortBy, sortDir]);

  const exportCSV = () => {
    const headers = "Tree_ID,Height,Crown_Diameter,Crown_Area\n";
    const rows = filtered.map((t) => `${t.Tree_ID},${t.Height},${t.Crown_Diameter},${t.Crown_Area}`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tree_features.csv";
    a.click();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Feature Extraction</h1>
          <p className="text-muted-foreground mt-1">Extracted tree features from LiDAR analysis</p>
        </div>
        <Button onClick={exportCSV} className="gradient-forest text-primary-foreground border-0 gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Tree ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Tree_ID">Tree ID</SelectItem>
            <SelectItem value="Height">Height</SelectItem>
            <SelectItem value="Crown_Diameter">Crown Diameter</SelectItem>
            <SelectItem value="Crown_Area">Crown Area</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => setSortDir((d) => d === "asc" ? "desc" : "asc")}>
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <div className="stat-card overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2.5 px-4 font-semibold text-foreground">Tree ID</th>
              <th className="text-left py-2.5 px-4 font-semibold text-foreground">Height (m)</th>
              <th className="text-left py-2.5 px-4 font-semibold text-foreground">Crown Diameter (m)</th>
              <th className="text-left py-2.5 px-4 font-semibold text-foreground">Crown Area (m²)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.Tree_ID} className="border-b border-border/30 hover:bg-muted/40 transition-colors">
                <td className="py-2 px-4 font-medium text-foreground">{t.Tree_ID}</td>
                <td className="py-2 px-4 text-muted-foreground">{t.Height}</td>
                <td className="py-2 px-4 text-muted-foreground">{t.Crown_Diameter}</td>
                <td className="py-2 px-4 text-muted-foreground">{t.Crown_Area}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground mt-3">Showing {filtered.length} of {sampleTrees.length} trees</p>
      </div>
    </div>
  );
};

export default FeaturesPage;
