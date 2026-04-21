from pathlib import Path
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

from pipeline_runner import run_pipeline

BASE_DIR = Path(__file__).resolve().parent

UPLOAD_DIR = BASE_DIR / "uploads"
OUTPUT_DIR = BASE_DIR / "outputs"

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

app = Flask(__name__)
CORS(app)

ALLOWED_EXTENSIONS = {".laz", ".las"}


def allowed_file(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS


@app.route("/")
def home():
    return jsonify({
        "message": "Forest Insight Backend Running"
    })


@app.get("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/api/process")
def process_file():
    try:

        if "file" not in request.files:
            return jsonify({"error": "No file uploaded."}), 400

        file = request.files["file"]

        plot_number = request.form.get("plot_number", "").strip()
        survey_date = request.form.get("survey_date", "").strip()

        if not file or file.filename == "":
            return jsonify({"error": "No file selected."}), 400

        if not plot_number:
            return jsonify({"error": "Plot number is required."}), 400

        if not survey_date:
            return jsonify({"error": "Survey date is required."}), 400

        if not allowed_file(file.filename):
            return jsonify({"error": "Only .laz or .las files allowed."}), 400

        filename = secure_filename(file.filename)

        saved_path = UPLOAD_DIR / filename

        file.save(saved_path)

        print(f"[UPLOAD] File saved: {saved_path}")

        # RUN PIPELINE
        result = run_pipeline(
            laz_path=str(saved_path),
            plot_number=plot_number,
            survey_date=survey_date,
            output_dir=str(OUTPUT_DIR)
        )

        return jsonify(result), 200

    except Exception as e:

        print("PIPELINE ERROR:", str(e))

        return jsonify({"error": str(e)}), 500


@app.get("/api/download/<plot_number>")
def download_csv(plot_number):

    csv_path = OUTPUT_DIR / f"FINAL_INVENTORY_REPORT.csv"

    if not csv_path.exists():
        return jsonify({"error": "CSV file not found."}), 404

    return send_file(csv_path, as_attachment=True)


if __name__ == "__main__":
    app.run(debug=True, port=8000)