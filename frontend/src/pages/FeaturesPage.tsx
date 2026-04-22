import { useEffect, useState } from "react";

type TreeFeature = {
  Temp_ID:number
  Easting:number
  Northing:number
  Tree_Height:number
  Crown_Diameter:number
}

const FeaturesPage = () => {

  const [rows,setRows] = useState<TreeFeature[]>([]);

  useEffect(()=>{

    const plot = localStorage.getItem("currentPlot");
    console.log("Plot at fetch:", plot);
    if(!plot) return;

    fetch(`http://127.0.0.1:8000/features/${plot}`)
      .then(res=>res.json())
      .then(data=>setRows(data));

  },[]);

  return (

    <div className="max-w-5xl mx-auto space-y-6">

      <h1 className="text-3xl font-bold">Feature Extraction</h1>

      <div className="stat-card overflow-auto">

        <table className="w-full">

          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 text-left">Tree ID</th>
              <th className="px-3 py-2 text-left">Species</th>
              <th className="px-3 py-2 text-left">Height (m)</th>
              <th className="px-3 py-2 text-left">Crown Diameter (m)</th>
              <th className="px-3 py-2 text-left">DBH (cm)</th>
              <th className="px-3 py-2 text-left">Biomass (kg)</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((t, i) => (
              <tr key={t.Tree_ID || i} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{t.Tree_ID}</td>
                <td className="px-3 py-2">{t.Species}</td>
                <td className="px-3 py-2">{t.Height?.toFixed(2)}</td>
                <td className="px-3 py-2">{t.Crown?.toFixed(2)}</td>
                <td className="px-3 py-2">{t.DBH?.toFixed(2)}</td>
                <td className="px-3 py-2">{t.Biomass?.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>

        </table>

      </div>

    </div>

  );

};

export default FeaturesPage;