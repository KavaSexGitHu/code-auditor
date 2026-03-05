import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldAlert,
  Search,
  Github,
  AlertTriangle,
  CheckCircle2,
  FileText,
  History,
  Activity,
  Cpu,
  Database as DbIcon,
  Terminal,
  Zap,
  Plus,
  Trash2,
  UserCheck,
  UserX,
  Code,
  FileCode,
  Layout,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  ClipboardList,
  Settings as SettingsIcon,
  Download,
  BarChart3,
  Fingerprint,
  X
} from 'lucide-react';
import { compareRepositories, ComparisonResult } from './services/geminiService';
import { AuditService, AIProvider, AIModel } from './services/AuditService';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
    electronAPI: {
      scanPath: (targetPath: string) => Promise<any>;
      onScanProgress: (callback: (value: number) => void) => void;
      removeScanProgressListener: () => void;
      openPdfExternal: (buffer: ArrayBuffer) => Promise<{ success: boolean }>;
      closeApp: () => Promise<void>;
    };
  }
}

const CircularProgress = ({ value, size = 80, strokeWidth = 6 }: { value: number, size?: number, strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  const getColor = (val: number) => {
    if (val < 30) return '#10b981'; // emerald-500
    if (val < 70) return '#f59e0b'; // amber-500
    return '#ef4444'; // red-500
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-white/5"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(value)}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${getColor(value)}44)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-white leading-none">{value}%</span>
        <span className="text-[7px] uppercase opacity-20 font-mono mt-1 tracking-widest">Match</span>
      </div>
    </div>
  );
};

export default function App() {
  const [repoUrls, setRepoUrls] = useState<string[]>(['', '']);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<any | null>(null);
  const [settings, setSettings] = useState({
    apiKey: '',
    model: 'gemini-3.1-pro-preview',
    provider: 'gemini' as AIProvider,
    baseUrl: ''
  });
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [scanLog, setScanLog] = useState<string[]>([]);
  const [hasPlatformKey, setHasPlatformKey] = useState(false);

  // Bridge and model fetching sequence
  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      // 1. Check for AI Studio Bridge
      try {
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
          const selected = await window.aistudio.hasSelectedApiKey();
          if (isMounted) setHasPlatformKey(selected);
        }
      } catch (err) {
        console.warn("Bridge check failed:", err);
      }

      // 2. Fetch models
      try {
        const models = await AuditService.getAvailableModels(
          settings.provider,
          settings.apiKey,
          settings.baseUrl
        );
        if (isMounted) {
          setAvailableModels(models);
          if (models.length > 0 && !models.find(m => m.id === settings.model)) {
            setSettings(prev => ({ ...prev, model: models[0].id }));
          }
        }
      } catch (err) {
        console.error("Model fetch failed:", err);
      }
    };

    initialize();
    return () => { isMounted = false; };
  }, [settings.provider, settings.apiKey, settings.baseUrl]);

  const handleSelectPlatformKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasPlatformKey(true);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error("History fetch failed", e);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data) setSettings(prev => ({ ...prev, ...data }));
    } catch (e) {
      console.error("Settings fetch failed", e);
    }
  };

  useEffect(() => {
    fetchHistory();
    fetchSettings();
  }, []);

  const saveSettings = async () => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      setShowSettings(false);
    } catch (e) {
      alert("Failed to save settings");
    }
  };

  const addRepoField = () => setRepoUrls([...repoUrls, '']);
  const removeRepoField = (index: number) => {
    if (repoUrls.length > 2) {
      const newUrls = [...repoUrls];
      newUrls.splice(index, 1);
      setRepoUrls(newUrls);
    }
  };

  const updateRepoUrl = (index: number, value: string) => {
    const newUrls = [...repoUrls];
    newUrls[index] = value;
    setRepoUrls(newUrls);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const activeUrls = repoUrls.filter(u => u.trim() !== '');
    if (activeUrls.length < 2) {
      alert("Please provide at least two repositories for comparison.");
      return;
    }

    setIsAnalyzing(true);
    setProgress(5);
    setScanLog(['🔧 [INIT] Initializing forensic engine...', '🔐 [AUTH] Validating repository access...']);
    setResult(null);

    let interval: any = null;

    try {
      // Step 1: Scan Source 1
      setScanLog(prev => [...prev, `📂 [SCAN] Fetching/Reading Source 1: ${activeUrls[0]}...`]);
      const code1 = await window.electronAPI.scanPath(activeUrls[0]);
      setProgress(40);
      setScanLog(prev => [...prev, `✅ [DONE] Source 1 content extracted (${code1.length} bytes).`]);

      // Step 2: Scan Source 2
      setScanLog(prev => [...prev, `📂 [SCAN] Fetching/Reading Source 2: ${activeUrls[1]}...`]);
      const code2 = await window.electronAPI.scanPath(activeUrls[1]);
      setProgress(70);
      setScanLog(prev => [...prev, `✅ [DONE] Source 2 content extracted (${code2.length} bytes).`]);

      setScanLog(prev => [...prev, `⚖️  [AUDIT] Starting Deep Forensic Analysis using ${settings.provider}...`]);

      // Convert state settings to AuditConfig and pass real code
      const auditResult = await AuditService.performAudit(code1, code2, {
        provider: settings.provider,
        modelId: settings.model,
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl
      });

      // Map AuditService result to App's expected ComparisonResult format
      const data: ComparisonResult = {
        verdict: auditResult.verdict as any,
        similarityScore: auditResult.similarity,
        findings: auditResult.findings || [],
        licenseConflicts: [],
        summary: auditResult.details,
        recommendations: auditResult.similarity > 70
          ? "⚠️ IMMEDIATE ACTION REQUIRED: Significant code overlap detected. Legal consultation recommended."
          : auditResult.similarity > 40
            ? "⚠️ REVIEW RECOMMENDED: Suspicious patterns detected. Manual review suggested."
            : "✅ LOW RISK: Minor similarities appear coincidental.",
        statisticalAnalysis: auditResult.statisticalAnalysis || {
          totalFilesCompared: 0,
          filesWithMatches: auditResult.findings?.length || 0,
          averageFileSimilarity: auditResult.similarity,
          highestMatch: { file: "N/A", score: 0 },
          codeVolumeAnalysis: "Complete"
        }
      };

      setProgress(100);
      setScanLog(prev => [...prev, ` [SUCCESS] ${auditResult.engine || 'AI'} analysis complete.`]);
      setResult(data);

      await fetch('/api/audit/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_urls: activeUrls,
          verdict: data.verdict,
          similarity_score: data.similarityScore,
          summary: data.summary,
          findings: data.findings
        })
      });

      fetchHistory();
    } catch (error: any) {
      console.error("Audit failed:", error);
      setScanLog(prev => [...prev, `❌ [ERROR] ${error.message}`]);
      alert(error.message || "AUDIT_ERROR: The analysis engine encountered an issue.");
    } finally {
      if (interval) clearInterval(interval);
      setIsAnalyzing(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  const generatePDF = () => {
    if (!result) return;

    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString();
    const signature = `SIG-${Math.random().toString(36).substring(2, 15).toUpperCase()}-${Date.now()}`;

    // Enhanced Color Scheme with Evidence Strength
    const colors = {
      GUILTY: {
        primary: [220, 38, 38],     // red-700
        light: [254, 226, 226],      // red-100
        dark: [127, 29, 29],         // red-900
        text: [255, 255, 255]
      },
      SUSPICIOUS: {
        primary: [217, 119, 6],      // amber-600
        light: [254, 243, 199],      // amber-100
        dark: [120, 53, 15],         // amber-900
        text: [255, 255, 255]
      },
      NOT_GUILTY: {
        primary: [5, 150, 105],      // emerald-600
        light: [209, 250, 229],      // emerald-100
        dark: [6, 78, 59],           // emerald-900
        text: [255, 255, 255]
      }
    };
    const theme = colors[result.verdict as keyof typeof colors] || colors.NOT_GUILTY;

    // Evidence Strength Colors
    const evidenceColors = {
      CRITICAL: [220, 38, 38],
      HIGH: [234, 88, 12],
      MEDIUM: [234, 179, 8],
      LOW: [163, 163, 163]
    };

    // ==================== PAGE 1: EXECUTIVE SUMMARY ====================

    // Professional Header with Gradient Effect
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 210, 45, 'F');

    // Title with shadow effect (simulated with offset)
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("FORENSIC CODE AUDIT", 20, 25);

    // Subtitle
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("INTELLECTUAL PROPERTY COMPLIANCE REPORT", 20, 33);

    doc.setFontSize(7);
    doc.setFont("courier", "normal");
    doc.text(`CERTIFICATE: ${signature}`, 20, 40);
    doc.text(`TIMESTAMP: ${timestamp}`, 140, 40, { align: "right" });

    // Verdict Card with Enhanced Design
    let yPos = 55;
    doc.setFillColor(theme.primary[0], theme.primary[1], theme.primary[2]);
    doc.roundedRect(20, yPos, 170, 40, 3, 3, 'F');

    // Verdict Badge
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("OFFICIAL VERDICT", 30, yPos + 12);

    doc.setFontSize(24);
    doc.text(result.verdict, 30, yPos + 28);

    // Similarity Score with Visual Indicator
    doc.setFontSize(10);
    doc.text("SIMILARITY INDEX", 130, yPos + 12);
    doc.setFontSize(32);
    doc.text(`${result.similarityScore}%`, 130, yPos + 30);

    // Risk Level Indicator
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const riskLevel = result.similarityScore > 70 ? "CRITICAL RISK" :
      result.similarityScore > 40 ? "MODERATE RISK" : "LOW RISK";
    doc.text(riskLevel, 130, yPos + 36);

    // Executive Summary Section
    yPos = 105;
    doc.setTextColor(0, 0, 0);
    doc.setFillColor(245, 247, 250);
    doc.rect(20, yPos, 170, 0.5, 'F');

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("EXECUTIVE SUMMARY", 20, yPos + 8);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const splitSummary = doc.splitTextToSize(result.summary, 165);
    doc.text(splitSummary, 22, yPos + 16);

    // Statistical Analysis Box
    yPos = yPos + 18 + (splitSummary.length * 5.5) + 5;

    if (result.statisticalAnalysis) {
      doc.setFillColor(theme.light[0], theme.light[1], theme.light[2]);
      doc.roundedRect(20, yPos, 170, 35, 2, 2, 'F');

      doc.setTextColor(theme.dark[0], theme.dark[1], theme.dark[2]);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("STATISTICAL ANALYSIS", 25, yPos + 8);

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Files Analyzed: ${result.statisticalAnalysis.totalFilesCompared}`, 25, yPos + 15);
      doc.text(`Files with Matches: ${result.statisticalAnalysis.filesWithMatches}`, 25, yPos + 21);
      doc.text(`Average Similarity: ${result.statisticalAnalysis.averageFileSimilarity.toFixed(1)}%`, 25, yPos + 27);

      if (result.statisticalAnalysis.highestMatch) {
        doc.text(`Highest Match: ${result.statisticalAnalysis.highestMatch.file} (${result.statisticalAnalysis.highestMatch.score}%)`, 100, yPos + 15);
      }
    }

    // Audited Sources Section
    yPos += 45;
    if (yPos > 250) { doc.addPage(); yPos = 20; }

    doc.setFillColor(245, 247, 250);
    doc.rect(20, yPos, 170, 0.5, 'F');

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("AUDITED SOURCES", 20, yPos + 8);

    doc.setFontSize(9);
    doc.setFont("courier", "normal");
    repoUrls.filter(u => u).forEach((url, i) => {
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(22, yPos + 12 + (i * 10), 166, 8, 1, 1, 'F');
      doc.setTextColor(60, 60, 60);
      doc.text(`[SOURCE ${i + 1}] ${url}`, 25, yPos + 17 + (i * 10));
    });

    // ==================== PAGE 2: EVIDENCE SUMMARY TABLE ====================
    doc.addPage();

    // Page Header
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("EVIDENCE LOG & FINDINGS", 20, 12);

    // Findings Summary Statistics
    yPos = 30;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Findings: ${result.findings.length}`, 20, yPos);

    const criticalCount = result.findings.filter(f => f.evidenceStrength === 'CRITICAL').length;
    const highCount = result.findings.filter(f => f.evidenceStrength === 'HIGH').length;
    const mediumCount = result.findings.filter(f => f.evidenceStrength === 'MEDIUM').length;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(220, 38, 38);
    doc.text(`● Critical: ${criticalCount}`, 100, yPos - 3);
    doc.setTextColor(234, 88, 12);
    doc.text(`● High: ${highCount}`, 100, yPos + 2);
    doc.setTextColor(234, 179, 8);
    doc.text(`● Medium: ${mediumCount}`, 100, yPos + 7);

    // Evidence Table with Color Coding
    const tableData = result.findings.map(f => {
      const strength = f.evidenceStrength || 'MEDIUM';
      return [
        f.fileName,
        f.lineRange || "N/A",
        `${f.similarity}%`,
        strength,
        f.explanation
      ];
    });

    autoTable(doc, {
      startY: yPos + 10,
      head: [['File/Resource', 'Line Range', 'Match %', 'Strength', 'Evidence Summary']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9
      },
      styles: {
        fontSize: 7,
        font: 'helvetica',
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 22 },
        2: { cellWidth: 18 },
        3: { cellWidth: 18 },
        4: { cellWidth: 'auto' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 3) {
          const strength = data.cell.raw as string;
          const color = evidenceColors[strength as keyof typeof evidenceColors] || [163, 163, 163];
          data.cell.styles.fillColor = color;
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
        }
        // Color code similarity percentage
        if (data.section === 'body' && data.column.index === 2) {
          const similarity = parseInt(data.cell.raw as string);
          if (similarity > 80) {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          } else if (similarity > 60) {
            data.cell.styles.textColor = [234, 88, 12];
          }
        }
      },
      margin: { left: 20, right: 20 }
    });

    // ==================== DETAILED EVIDENCE PAGES ====================
    result.findings.forEach((finding, index) => {
      doc.addPage();

      // Evidence Header with Color Coding
      const strength = finding.evidenceStrength || 'MEDIUM';
      const headerColor = evidenceColors[strength as keyof typeof evidenceColors];

      doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
      doc.rect(0, 0, 210, 25, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`EXHIBIT #${index + 1}`, 20, 12);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(finding.fileName, 20, 19);

      // Evidence Strength Badge
      doc.setFontSize(8);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(165, 8, 35, 10, 2, 2, 'F');
      doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
      doc.text(`${strength} RISK`, 182.5, 14, { align: 'center' });

      // Similarity Score Circle
      let yPos = 35;
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("SIMILARITY SCORE:", 20, yPos);

      // Draw circular progress indicator
      const centerX = 50;
      const centerY = yPos + 8;
      const radius = 8;

      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(1.5);
      doc.circle(centerX, centerY, radius);

      const similarity = finding.similarity;
      const scoreColor = similarity > 80 ? [220, 38, 38] :
        similarity > 60 ? [234, 88, 12] : [234, 179, 8];
      doc.setDrawColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.setLineWidth(2);

      const endAngle = (similarity / 100) * 360 - 90;
      // Approximate arc drawing (jsPDF doesn't have native arc support)

      doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(`${similarity}%`, centerX, centerY + 2, { align: 'center' });

      // Line Range Information
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Line Range: ${finding.lineRange}`, 70, yPos + 10);

      // Forensic Explanation Box
      yPos += 20;
      doc.setFillColor(255, 250, 240);
      doc.roundedRect(20, yPos, 170, 40, 2, 2, 'F');

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("🔍 FORENSIC ANALYSIS:", 25, yPos + 8);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const splitExp = doc.splitTextToSize(finding.explanation, 160);
      doc.text(splitExp, 25, yPos + 15);

      // Obfuscation Indicator
      if (finding.obfuscationDetected) {
        yPos += 42;
        doc.setFillColor(254, 226, 226);
        doc.roundedRect(20, yPos, 170, 10, 1, 1, 'F');
        doc.setTextColor(153, 27, 27);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("⚠️ CODE OBFUSCATION DETECTED - Intentional modification suspected", 25, yPos + 6);
        yPos += 12;
      } else {
        yPos += 42;
      }

      // Original Code Box (Source) - Dynamic height
      const origCodeText = finding.originalCode || 'No source code captured';
      const splitOrig = doc.splitTextToSize(origCodeText, 160).slice(0, 30);
      const origBoxH = Math.max(25, splitOrig.length * 3.5 + 12);

      doc.setFillColor(240, 253, 244);
      doc.roundedRect(20, yPos, 170, origBoxH, 2, 2, 'F');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(5, 150, 105);
      doc.text(`SOURCE CODE (${finding.sourceRepo || 'Repository 1'}):`, 25, yPos + 8);

      doc.setFont("courier", "normal");
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      doc.text(splitOrig, 25, yPos + 15);

      yPos += origBoxH + 5;

      // Page overflow check
      if (yPos > 220) { doc.addPage(); yPos = 20; }

      // Suspect Code Box (Target) - Dynamic height
      const suspectCodeText = finding.suspectCode || 'No suspect code captured';
      const splitSuspect = doc.splitTextToSize(suspectCodeText, 160).slice(0, 30);
      const suspectBoxH = Math.max(25, splitSuspect.length * 3.5 + 12);

      doc.setFillColor(254, 242, 242);
      doc.roundedRect(20, yPos, 170, suspectBoxH, 2, 2, 'F');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(220, 38, 38);
      doc.text(`SUSPECT CODE (${finding.targetRepo || 'Repository 2'}):`, 25, yPos + 8);

      doc.setFont("courier", "normal");
      doc.setFontSize(7);
      doc.setTextColor(0, 0, 0);
      doc.text(splitSuspect, 25, yPos + 15);
    });

    // ==================== RECOMMENDATIONS PAGE ====================
    doc.addPage();

    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("RECOMMENDATIONS & NEXT STEPS", 20, 12);

    yPos = 35;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("PROFESSIONAL RECOMMENDATIONS", 20, yPos);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const splitRec = doc.splitTextToSize(result.recommendations, 170);
    doc.text(splitRec, 20, yPos + 10);

    yPos = yPos + 10 + (splitRec.length * 5.5) + 10;

    // Action Items Based on Verdict
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(20, yPos, 170, 80, 2, 2, 'F');

    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("IMMEDIATE ACTION ITEMS:", 25, yPos + 10);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    const actionItems = result.verdict === 'GUILTY' ? [
      "1. Engage legal counsel immediately for IP violation assessment",
      "2. Document all findings and preserve evidence",
      "3. Initiate formal investigation and cease & desist proceedings",
      "4. Review internal code review and approval processes",
      "5. Conduct comprehensive audit of entire codebase"
    ] : result.verdict === 'SUSPICIOUS' ? [
      "1. Conduct detailed manual code review by senior developers",
      "2. Interview development team about code origin",
      "3. Review commit history and authorship records",
      "4. Consider requesting expert legal opinion",
      "5. Implement enhanced code review procedures"
    ] : [
      "1. Document independent development process",
      "2. Maintain audit trail for future reference",
      "3. Continue standard code review practices",
      "4. No immediate legal action required",
      "5. Monitor for any future similarity concerns"
    ];

    actionItems.forEach((item, i) => {
      doc.text(item, 25, yPos + 20 + (i * 8));
    });

    // Certificate Footer
    yPos = 260;
    doc.setFillColor(0, 0, 0);
    doc.rect(0, yPos, 210, 37, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("DIGITAL CERTIFICATION", 105, yPos + 10, { align: 'center' });

    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.text(`Signature: ${signature}`, 105, yPos + 18, { align: 'center' });
    doc.text(`Generated: ${timestamp}`, 105, yPos + 24, { align: 'center' });
    doc.text("This is an automated forensic report generated by Code Auditor™", 105, yPos + 30, { align: 'center' });

    // Add Page Numbers and Footers
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Confidential Forensic Report - Page ${i} of ${pageCount}`, 105, 290, { align: "center" });

      // Add watermark on each page
      doc.setTextColor(240, 240, 240);
      doc.setFontSize(50);
      doc.setFont("helvetica", "bold");
      doc.text(result.verdict, 105, 150, {
        align: "center",
        angle: 45,
        renderingMode: "stroke"
      });
    }

    // Export PDF
    const buffer = doc.output('arraybuffer');
    if (window.electronAPI?.openPdfExternal) {
      window.electronAPI.openPdfExternal(buffer);
    } else {
      const blobObj = new Blob([buffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blobObj);
      window.open(url, '_blank');
    }
  };

  const chartData = result?.findings.map(f => ({
    name: f.fileName.split('/').pop(),
    similarity: f.similarity
  })) || [];

  return (
    <div className="h-screen w-full bg-[#020202]/60 backdrop-blur-2xl text-[#f5f5f7] font-sans selection:bg-white selection:text-black overflow-hidden relative border border-white/10 flex flex-col">
      {/* Atmospheric Background Blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-emerald-500/10 blur-[80px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-rose-500/10 blur-[80px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Background Dashboard Grid (Subtle) */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="grid grid-cols-4 gap-2 p-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-20 border border-white/5 rounded-lg bg-white/[0.01]" />
          ))}
        </div>
      </div>

      {/* Main Audit Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        <div className="p-3 border-b border-white/5 bg-white/5 flex items-center justify-between" style={{ WebkitAppRegion: 'drag' } as any}>
          <div className="flex items-center gap-2">
            <div className="flex flex-col pl-1">
              <span className="text-[13px] font-bold uppercase tracking-widest text-white leading-none">Code Auditor</span>
              <span className="text-[13px] opacity-30 font-mono uppercase tracking-tighter">Premium</span>
            </div>
          </div>
          <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <button
              onClick={() => setShowSettings(true)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 text-white/20 hover:text-white transition-all"
            >
              <SettingsIcon size={14} />
            </button>
            <button
              onClick={() => window.electronAPI?.closeApp()}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-rose-500/20 text-white/20 hover:text-rose-400 transition-all font-bold"
              title="Exit Application"
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="p-4 flex-1 flex flex-col overflow-y-auto custom-scrollbar space-y-4">

          {!result && !isAnalyzing ? (
            <form onSubmit={handleAnalyze} className="flex-1 flex flex-col space-y-4 overflow-hidden">
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                {repoUrls.map((url, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[13px] opacity-60 font-mono text-white/80">SRC_{index + 1}</span>
                      {repoUrls.length > 2 && (
                        <button type="button" onClick={() => removeRepoField(index)} className="text-white/20 hover:text-white">
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/20 group-focus-within:text-white/60 transition-colors">
                        <Search size={14} />
                      </div>
                      <input
                        type="text"
                        value={url}
                        onChange={(e) => updateRepoUrl(index, e.target.value)}
                        placeholder="GitHub URL or Local Path..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-[14px] text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all font-mono"
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={addRepoField} className="flex-1 border border-white/10 py-3 rounded-xl text-[14px] font-bold uppercase text-white/60 hover:bg-white/5 transition-all">
                  + Add Source
                </button>
                <button className="flex-1 bg-white text-black py-3 rounded-xl text-[14px] font-bold uppercase hover:bg-white/90 shadow-lg shadow-white/5 transition-all">
                  Start Analysis
                </button>
              </div>
            </form>
          ) : isAnalyzing ? (
            <div className="flex-1 flex flex-col space-y-4 overflow-hidden">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Activity size={12} className="text-white animate-pulse" />
                  <span className="text-[13px] font-bold text-white uppercase tracking-widest">Deep Scanning...</span>
                </div>
                <span className="text-[14px] font-mono opacity-50 text-white">{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 bg-white/10 w-full rounded-full overflow-hidden border border-white/5">
                <motion.div className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500" animate={{ width: `${progress}%` }} />
              </div>
              <div className="flex-1 bg-black/40 border border-white/5 rounded-lg p-3 font-mono text-[13px] overflow-y-auto custom-scrollbar relative">
                <div className="space-y-1">
                  {scanLog.map((log, i) => (
                    <div key={i} className={`truncate ${log.includes('[SUCCESS]') || log.includes('✨') || log.includes('✅') ? 'text-emerald-400' :
                      log.includes('[ERROR]') || log.includes('❌') ? 'text-rose-400' :
                        log.includes('[AUDIT]') || log.includes('⚖️') ? 'text-amber-400' :
                          'text-white/40'
                      }`}>{log}</div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col space-y-3 overflow-hidden">
              {/* Executive Header */}
              <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <CircularProgress value={result.similarityScore} size={45} strokeWidth={5} />
                  <div>
                    <div className={`text-[14px] font-black uppercase tracking-widest ${result.verdict === 'GUILTY' ? 'text-rose-400' :
                      result.verdict === 'SUSPICIOUS' ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                      {result.verdict}
                    </div>
                    <div className="text-[12px] opacity-40 uppercase font-bold">{result.findings.length} EXHIBITS SECURED</div>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={generatePDF}
                    className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-all"
                    title="Export PDF Report"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => setResult(null)}
                    className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-all"
                    title="New Scan"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Scrollable Forensic Evidence */}
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {/* Executive Summary */}
                {result.summary && (
                  <div className="bg-white/5 border border-white/5 rounded-lg p-3">
                    <div className="text-[9px] font-bold uppercase text-white/30 mb-1">Executive Summary</div>
                    <p className="text-[12px] leading-relaxed text-white/60">{result.summary}</p>
                  </div>
                )}

                {/* Stats Summary */}
                {result.statisticalAnalysis && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-white/5 border border-white/5 rounded-lg p-2 text-center">
                      <div className="text-[7px] opacity-40 uppercase">Files Scanned</div>
                      <div className="text-[13px] font-mono font-bold text-white/80">{result.statisticalAnalysis.totalFilesCompared}</div>
                    </div>
                    <div className="bg-white/5 border border-white/5 rounded-lg p-2 text-center">
                      <div className="text-[7px] opacity-40 uppercase">Peak Match</div>
                      <div className="text-[13px] font-mono font-bold text-emerald-400">{result.statisticalAnalysis.highestMatch?.score || 0}%</div>
                    </div>
                  </div>
                )}

                {/* Findings List */}
                {result.findings.map((f, i) => (
                  <div key={i} className="bg-white/5 border border-white/5 rounded-xl p-3 space-y-2 group transition-all hover:bg-white/[0.07]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileCode size={14} className="text-white/40 shrink-0" />
                        <span className="text-[13px] font-mono text-white/80 truncate">{f.fileName}</span>
                      </div>
                      <span className={`text-[9px] font-black px-2 py-1 rounded uppercase shrink-0 ${f.evidenceStrength === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' :
                        f.evidenceStrength === 'HIGH' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                        {f.evidenceStrength || 'MATCH'} ({f.similarity}%)
                      </span>
                    </div>
                    {f.lineRange && (
                      <div className="text-[11px] font-mono text-white/30">Lines: {f.lineRange}</div>
                    )}
                    <p className="text-[12px] leading-relaxed text-white/60">{f.explanation}</p>

                    {/* Code Preview & Action */}
                    <div className="pt-1 flex flex-col gap-2">
                      {f.originalCode && (
                        <div className="space-y-1">
                          <div className="text-[9px] font-bold uppercase text-emerald-400/60">Source Code:</div>
                          <div className="bg-emerald-500/5 rounded-lg p-2 font-mono text-[10px] overflow-hidden max-h-[60px] opacity-70 border border-emerald-500/10">
                            {f.originalCode?.substring(0, 200)}{(f.originalCode?.length || 0) > 200 ? '...' : ''}
                          </div>
                        </div>
                      )}
                      {f.suspectCode && (
                        <div className="space-y-1">
                          <div className="text-[9px] font-bold uppercase text-rose-400/60">Suspect Code:</div>
                          <div className="bg-rose-500/5 rounded-lg p-2 font-mono text-[10px] overflow-hidden max-h-[60px] opacity-70 border border-rose-500/10">
                            {f.suspectCode?.substring(0, 200)}{(f.suspectCode?.length || 0) > 200 ? '...' : ''}
                          </div>
                        </div>
                      )}
                      <button
                        onClick={() => setSelectedFinding(f)}
                        className="w-full bg-white/5 hover:bg-white/10 border border-white/5 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-wider text-white/40 flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Search size={10} /> View Full Comparison
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {selectedFinding && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="bg-[#0a0a0c] border border-white/10 w-full max-w-[560px] h-[360px] rounded-2xl flex flex-col shadow-2xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Fingerprint size={16} />
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="text-[13px] font-black uppercase text-white tracking-widest truncate">{selectedFinding.fileName}</h3>
                    <p className="text-[12px] text-white/30 font-mono">{selectedFinding.lineRange || 'Logic Fingerprint Analysis'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFinding(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40 transition-all"
                >
                  <Plus size={18} className="rotate-45" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                <div className="bg-white/5 border border-white/5 rounded-xl p-3">
                  <h4 className="text-[9px] font-black text-white/40 uppercase mb-2">Forensic Justification</h4>
                  <p className="text-[12px] text-white/70 leading-relaxed">{selectedFinding.explanation}</p>
                </div>

                <div className="space-y-3">
                  {/* Original Code */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[8px] font-black text-emerald-400/60 uppercase">Source Logic (Original)</span>
                      <span className="text-[8px] font-mono text-white/20">{selectedFinding.sourceRepo || 'Evidence A'}</span>
                    </div>
                    <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 font-mono text-[9px] text-emerald-100/80 overflow-x-auto whitespace-pre leading-normal">
                      {selectedFinding.originalCode || "// No snippet provided"}
                    </div>
                  </div>

                  {/* Suspect Code */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[8px] font-black text-rose-400/60 uppercase">Suspect Logic (Match)</span>
                      <span className="text-[8px] font-mono text-white/20">{selectedFinding.targetRepo || 'Evidence B'}</span>
                    </div>
                    <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 font-mono text-[9px] text-rose-100/80 overflow-x-auto whitespace-pre leading-normal">
                      {selectedFinding.suspectCode || "// No snippet provided"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${selectedFinding.similarity > 70 ? 'bg-rose-500' : 'bg-amber-500'} animate-pulse`} />
                  <span className="text-[9px] font-black uppercase text-white/60">Match Probability: {selectedFinding.similarity}%</span>
                </div>
                <button
                  onClick={() => setSelectedFinding(null)}
                  className="px-4 py-2 bg-white text-black rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-white/90 transition-all"
                >
                  Close Case
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1a1a1c] border border-white/10 w-[320px] rounded-2xl p-5 space-y-4 shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                    <SettingsIcon size={14} className="text-white/80" />
                  </div>
                  <h2 className="text-[13px] font-bold text-white uppercase tracking-widest text-shadow-sm">Engine Configuration</h2>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all border border-transparent hover:border-white/10"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="space-y-4 max-h-[220px] overflow-y-auto px-1 custom-scrollbar">
                {/* Provider Selection */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold opacity-40 uppercase tracking-tighter text-white">Analysis Provider</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['gemini', 'openai', 'ollama', 'local-python'].map((p) => (
                      <button
                        key={p}
                        onClick={() => setSettings({ ...settings, provider: p as AIProvider })}
                        className={`py-2 px-3 rounded-lg text-[9px] font-bold uppercase border transition-all ${settings.provider === p
                          ? 'bg-white/15 border-white/30 text-white'
                          : 'bg-white/5 border-white/5 text-white/30 hover:bg-white/10 hover:text-white/60'
                          }`}
                      >
                        {p.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* API Key Section */}
                {settings.provider !== 'local-python' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-bold opacity-40 uppercase tracking-tighter text-white">
                        {settings.provider === 'ollama' ? 'Base URL' : 'API Security Key'}
                      </label>
                      {settings.provider === 'gemini' && window.aistudio && (
                        <button
                          onClick={handleSelectPlatformKey}
                          className={`text-[8px] px-2 py-0.5 rounded-full border transition-all ${hasPlatformKey
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                            : 'bg-white/10 border-white/20 text-white/60 hover:text-white'
                            }`}
                        >
                          {hasPlatformKey ? '✓ Bridge Active' : 'Connect AI Studio'}
                        </button>
                      )}
                    </div>
                    <input
                      type={settings.provider === 'ollama' ? "text" : "password"}
                      value={settings.provider === 'ollama' ? settings.baseUrl : settings.apiKey}
                      onChange={(e) => setSettings({
                        ...settings,
                        [settings.provider === 'ollama' ? 'baseUrl' : 'apiKey']: e.target.value
                      })}
                      placeholder={settings.provider === 'ollama' ? "http://localhost:11434" : "••••••••••••••••"}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[12px] focus:border-white/30 focus:bg-white/5 outline-none transition-all font-mono text-white placeholder:text-white/10"
                    />
                  </div>
                )}

                {/* Model Selection */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold opacity-40 uppercase tracking-tighter text-white">Technical Model</label>
                  <div className="relative">
                    <select
                      value={settings.model}
                      onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-[12px] focus:border-white/30 focus:bg-white/5 outline-none transition-all font-mono text-white appearance-none cursor-pointer"
                    >
                      {availableModels.length > 0 ? (
                        availableModels.map(m => (
                          <option key={m.id} value={m.id} className="bg-[#1a1a1c] text-white py-2">{m.name}</option>
                        ))
                      ) : (
                        <option value="" className="bg-[#1a1a1c] text-white/40">Loading models...</option>
                      )}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                      <ChevronDown size={12} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={saveSettings}
                  className="w-full bg-white text-black py-3 rounded-xl text-[12px] font-black uppercase hover:bg-white/90 shadow-[0_4px_20px_rgba(255,255,255,0.15)] active:scale-[0.98] transition-all"
                >
                  💾 Save Configuration
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
      `}</style>
    </div>
  );
}
