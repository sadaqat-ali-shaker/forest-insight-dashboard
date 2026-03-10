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

          <thead>

            <tr>
              <th>Tree ID</th>
              <th>Height</th>
              <th>Crown Diameter</th>
            </tr>

          </thead>

          <tbody>

            {rows.map((t)=>(
              <tr key={t.Temp_ID}>
                <td>{t.Temp_ID}</td>
                <td>{t.Tree_Height}</td>
                <td>{t.Crown_Diameter}</td>
              </tr>
            ))}

          </tbody>

        </table>

      </div>

    </div>

  );

};

export default FeaturesPage;