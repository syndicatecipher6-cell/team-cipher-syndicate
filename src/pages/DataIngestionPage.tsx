import React, { useRef, useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  FileCode,
  File,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Sparkles,
  PhoneCall,
  Landmark,
} from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import { useNavigate } from 'react-router-dom';

export function DataIngestionPage() {
  const { pipelineJobs, uploadFiles, loadSampleSIHData, clearAllData, isDataLoaded } = useInvestigation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void uploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void uploadFiles(e.dataTransfer.files);
    }
  };

  const handleLoadSample = async () => {
    setLoadingSample(true);
    await loadSampleSIHData();
    setLoadingSample(false);
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'csv':
        return <FileSpreadsheet className="pipeline-file-icon text-emerald" size={22} />;
      case 'json':
        return <FileCode className="pipeline-file-icon text-amber" size={22} />;
      case 'pdf':
        return <FileText className="pipeline-file-icon text-blue" size={22} />;
      default:
        return <File className="pipeline-file-icon text-muted" size={22} />;
    }
  };

  return (
    <div className="ingestion-page-layout">
      {/* Left Column: Upload New Data */}
      <div className="upload-column">
        <div className="section-title-row">
          <h1 className="section-heading">Upload New Data</h1>
        </div>

        {/* Drag & Drop Card */}
        <div
          className={`dropzone-box ${isDragging ? 'dropzone-active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            multiple
            accept=".csv,.json,.pdf,.txt"
            style={{ display: 'none' }}
          />
          <div className="dropzone-tray-icon">
            <div className="tray-arrow-container">
              <div className="tray-down-arrow" />
              <div className="tray-base" />
            </div>
          </div>
          <h3 className="dropzone-title">Drag & Drop files here</h3>
          <p className="dropzone-subtitle">Support for CSV, JSON, PDF (FIRs), and unstructured text.</p>
          <button
            type="button"
            className="browse-files-btn"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Browse Files
          </button>
        </div>



        {isDataLoaded && (
          <div className="pipeline-success-banner">
            <div>
              <strong>Files Ingested & Analyzed</strong>
              <p>Entities extracted and Knowledge Graph generated. You can now view the updated dashboard.</p>
            </div>
            <button className="view-analytics-btn" onClick={() => navigate('/dashboard')}>
              View Analytics →
            </button>
          </div>
        )}
      </div>

      {/* Right Column: Processing Pipeline Status */}
      <div className="pipeline-column">
        <div className="pipeline-header-row">
          <h2 className="section-heading">Processing Pipeline Status</h2>
          <span className="system-status-pill">
            <span className="pulse-dot" />
            System Operational
          </span>
        </div>

        <div className="pipeline-cards-list">
          {pipelineJobs.length === 0 ? (
            <div className="pipeline-empty-card">
              <div className="empty-icon-circle">
                <Clock size={28} />
              </div>
              <h3>No Active Pipeline Jobs</h3>
              <p>The pipeline is currently idle. Upload CSV, JSON, or FIR documents to begin automated ingestion, entity extraction, and link analysis.</p>
            </div>
          ) : (
            pipelineJobs.map((job) => (
              <div key={job.id} className={`pipeline-job-card ${job.status}`}>
                <div className="job-card-top">
                  <div className="job-name-wrap">
                    {getFileIcon(job.fileType)}
                    <span className="job-filename">{job.fileName}</span>
                  </div>
                  <span className={`job-status-badge ${job.status}`}>
                    {job.status === 'completed' && 'Completed'}
                    {job.status === 'processing' && `Processing (${job.progress}%)`}
                    {job.status === 'failed' && 'Failed'}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="job-progress-track">
                  <div
                    className={`job-progress-fill ${job.status}`}
                    style={{ width: `${job.progress}%` }}
                  />
                </div>

                {/* Status message / metrics */}
                <div className="job-card-bottom">
                  {job.status === 'completed' && (
                    <span className="job-metric-text">
                      <CheckCircle2 size={13} className="text-emerald" />
                      {job.nodesCreated?.toLocaleString()} Nodes created, {job.edgesCreated?.toLocaleString()} Edges created
                    </span>
                  )}
                  {job.status === 'processing' && (
                    <span className="job-stage-text">
                      <Clock size={13} className="spin" />
                      {job.stageMessage || 'Extracting Entities... Est. time: 30s'}
                    </span>
                  )}
                  {job.status === 'failed' && (
                    <div className="job-error-row">
                      <span className="job-error-text">
                        <AlertCircle size={13} className="text-red" />
                        {job.errorMessage || 'Error: Schema mismatch on line 42'}
                      </span>
                      <button
                        className="view-logs-link"
                        onClick={() => alert(`Log details for ${job.fileName}: Schema validation failed.`)}
                      >
                        View Logs
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
