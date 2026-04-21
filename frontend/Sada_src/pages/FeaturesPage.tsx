import { useEffect, useState } from "react";

type TreeFeature = {
  Tree_ID: string;
  Easting: number;
  Northing: number;
  Height: number;
  Crown: number;
};

const FeaturesPage = () => {
  const [rows, setRows] = useState<TreeFeature[]>([]);

  useEffect(() => {
    const plot = localStorage.getItem("currentPlot");

    if (!plot) {
      console.warn("No plot selected");
      return;
    }

    fetch(`http://127.0.0.1:8000/features/${plot}`)
      .then((res) => res.json())
      .then((data) => {
        console.log("M3 Features data:", data); // DEBUG
        setRows(data);
      })
      .catch((err) => {
        console.error("Error fetching features:", err);
      });

  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Feature Extraction (Module 3)</h1>

      <div className="stat-card overflow-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th>Tree ID</th>
              <th>Height</th>
              <th>Crown Diameter</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((t) => (
              <tr key={t.Tree_ID}>
                <td>{t.Tree_ID}</td>
                <td>{t.Height}</td>
                <td>{t.Crown}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="text-center mt-4 text-gray-500">
            No data available. Upload a file first.
          </p>
        )}
      </div>
    </div>
  );
};

export default FeaturesPage;