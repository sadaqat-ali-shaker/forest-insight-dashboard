# Forest Insight Dashboard: LiDAR-Based Forest Monitoring System

## 1. Introduction

The **Forest Insight Dashboard** is a Final Year Project (FYP) developed to analyze and visualize forest data using LiDAR (Light Detection and Ranging) technology. The system processes point cloud data to extract meaningful insights about forest structure, including tree height, canopy density, and vegetation distribution.

The project integrates data processing, machine learning techniques, and a web-based dashboard to provide an accessible platform for forest monitoring and analysis.

---

## 2. Objectives

* To process and analyze LiDAR-based forest data
* To estimate forest attributes such as tree height and density
* To develop an interactive dashboard for visualization
* To support environmental monitoring and decision-making

---

## 3. System Overview

The system consists of two main components:

### Frontend

A web-based user interface developed using modern JavaScript frameworks for visualization and interaction.

### Backend

A data processing and analysis layer responsible for handling LiDAR data, performing computations, and serving results through APIs.

---

## 4. Technologies Used

### Frontend

* React (Vite)
* TypeScript
* Tailwind CSS

### Backend

* Python
* Flask / FastAPI
* NumPy
* Pandas
* Scikit-learn
* LiDAR processing libraries (e.g., laspy)

---

## 5. Project Structure

```bash
forest-insight-dashboard/
│
├── frontend/        # Frontend application
├── backend/         # Backend services and processing
├── src/             # Frontend source code
├── public/          # Static assets
├── sample_data/     # Sample LiDAR datasets
├── screenshots/     # System interface images
└── README.md
```

---

## 6. Installation and Setup

### Clone Repository

```bash
git clone https://github.com/sadaqat-ali-shaker/forest-insight-dashboard.git
cd forest-insight-dashboard
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate      # On Windows
pip install -r requirements.txt
python app.py
```

---

## 7. Key Features

* Processing of LiDAR point cloud data
* Extraction of forest structural attributes
* Interactive dashboard for visualization
* Integration of data analysis and web technologies

---

## 8. Use Cases

* Forest monitoring and management
* Environmental and ecological research
* Biomass and vegetation analysis
* Academic and research applications

---

## 9. Future Work

* Integration of real-time LiDAR data sources
* Enhancement using deep learning models
* Cloud-based deployment
* Improved scalability and performance

---

## 10. Team Members

* Sadaqat Ali
* Noman Shahid
* Ahmad Waheed

---

## 11. License

This project is developed for academic purposes as part of a Final Year Project.
