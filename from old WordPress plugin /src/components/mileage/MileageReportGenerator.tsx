import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '../ui/Button';
import Card from '../ui/Card';
import {
    HiOutlineDocumentArrowDown,
    HiOutlineCalendar,
    HiOutlineUserGroup,
    HiOutlineCurrencyDollar,
    HiOutlinePrinter,
    HiOutlineCheckCircle,
    HiOutlineMagnifyingGlass,
    HiOutlineCheck
} from 'react-icons/hi2';
import { getCachedUsers } from '@/services/userCache';
import jsPDF from 'jspdf';

interface UserOption {
    id: number;
    display_name: string;
    archived: boolean;
}

interface ReportEntry {
    id: number;
    trip_date: string;
    business_purpose: string;
    calculated_miles: number;
    odometer_start: number | null;
    odometer_end: number | null;
    tolls: number;
    parking: number;
    account_code: string;
    account_name: string;
    stops: Array<{
        location_name?: string;
        custom_address?: string;
        distance_to_next?: number;
    }>;
}

interface UserReport {
    user_id: number;
    user_name: string;
    entries: ReportEntry[];
    total_miles: number;
    total_tolls: number;
    total_parking: number;
    budget_accounts: Record<string, number>;
}

interface ReportMeta {
    date_from: string;
    date_to: string;
    generated_at: string;
    generated_by: string;
    organization_name: string;
    rate_per_mile: number;
}

interface MileageSettings {
    rate_per_mile: string;
}

interface MileageReportGeneratorProps {
    canViewAll: boolean;
}

const MileageReportGenerator: React.FC<MileageReportGeneratorProps> = ({ canViewAll }) => {
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [includePayout, setIncludePayout] = useState(true);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [settings, setSettings] = useState<MileageSettings>({ rate_per_mile: '0.70' });
    const [reportData, setReportData] = useState<UserReport[]>([]);
    const [_reportMeta, setReportMeta] = useState<ReportMeta | null>(null);
    const [loading, setLoading] = useState(false);
    const [generating, setGenerating] = useState(false);

    const apiUrl = window.mentorshipPlatformData?.api_url || '/wp-json/mentorship-platform/v1';
    const nonce = window.mentorshipPlatformData?.nonce || '';

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const [usersData, settingsRes] = await Promise.all([
                canViewAll ? getCachedUsers() : Promise.resolve([]),
                fetch(`${apiUrl}/mileage/settings`, { headers: { 'X-WP-Nonce': nonce } })
            ]);

            if (canViewAll) {
                setUsers(usersData.map(u => ({ 
                    id: u.user_id, 
                    display_name: u.display_name,
                    archived: u.archived ?? false
                })));
            }

            if (settingsRes.ok) {
                setSettings(await settingsRes.json());
            }
        } catch (err) {
            console.error('Failed to load initial data:', err);
        }
    };

    const generateReport = async () => {
        if (!dateFrom || !dateTo) {
            alert('Please select both start and end dates');
            return;
        }

        setLoading(true);
        try {
            const params = new URLSearchParams({
                date_from: dateFrom,
                date_to: dateTo
            });

            // Use appropriate endpoint based on permissions
            let endpoint = '/mileage/my-report'; // Default: own entries only
            
            if (canViewAll) {
                endpoint = '/mileage/report';
                if (selectedUsers.length > 0) {
                    selectedUsers.forEach(id => params.append('user_ids[]', String(id)));
                }
            }

            const response = await fetch(`${apiUrl}${endpoint}?${params}`, {
                headers: { 'X-WP-Nonce': nonce }
            });

            if (response.ok) {
                const data = await response.json();
                setReportData(data.users || []);
                setReportMeta(data.report_meta || null);
            } else {
                const error = await response.json();
                console.error('Report error:', error);
                alert('Failed to generate report. You may not have permission.');
            }
        } catch (err) {
            console.error('Failed to generate report:', err);
        } finally {
            setLoading(false);
        }
    };

    // Filtered users - hide archived unless explicitly searched or selected
    const filteredUsers = useMemo(() => {
        const search = userSearch.toLowerCase().trim();
        
        // If searching, include archived users that match
        // If not searching, only show non-archived users
        const filtered = users.filter(u => {
            const nameMatch = u.display_name.toLowerCase().includes(search);
            
            // Always show selected users
            if (selectedUsers.includes(u.id)) {
                return search ? nameMatch : true;
            }
            
            // If searching, show matching users (including archived)
            if (search) {
                return nameMatch;
            }
            
            // Not searching - hide archived
            return !u.archived;
        });
        
        // Sort: selected first, then alphabetically
        const selectedIds = new Set(selectedUsers);
        const selected = filtered.filter(u => selectedIds.has(u.id));
        const unselected = filtered.filter(u => !selectedIds.has(u.id));
        
        return [...selected, ...unselected];
    }, [users, userSearch, selectedUsers]);

    const toggleUser = (userId: number) => {
        setSelectedUsers(prev => {
            const isCurrentlySelected = prev.includes(userId);
            const newSelection = isCurrentlySelected 
                ? prev.filter(id => id !== userId)
                : [...prev, userId];
            return newSelection;
        });
    };

    const formatDate = (dateStr: string) => {
        // Parse as local date to avoid timezone issues (date comes as YYYY-MM-DD)
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
        });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    };

    const getRouteText = (stops: ReportEntry['stops']) => {
        if (!stops || stops.length === 0) return '';
        return stops.map(s => s.location_name || s.custom_address || '?').join(' → ');
    };

    const downloadPDF = async () => {
        if (reportData.length === 0) return;

        setGenerating(true);
        try {
            const pdf = new jsPDF('p', 'mm', 'letter');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const margin = 15;
            const contentWidth = pageWidth - margin * 2;
            const rate = parseFloat(settings.rate_per_mile) || 0;

            reportData.forEach((userReport, userIndex) => {
                if (userIndex > 0) {
                    pdf.addPage();
                }

                let y = margin;

                // Header
                pdf.setFontSize(16);
                pdf.setFont('helvetica', 'bold');
                pdf.text('MILEAGE REIMBURSEMENT FORM', pageWidth / 2, y, { align: 'center' });
                y += 10;

                // Date Range
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                pdf.text(`Period: ${formatDate(dateFrom)} - ${formatDate(dateTo)}`, pageWidth / 2, y, { align: 'center' });
                y += 10;

                // Employee Name
                pdf.setFontSize(12);
                pdf.setFont('helvetica', 'bold');
                pdf.text(`Employee: ${userReport.user_name}`, margin, y);
                y += 10;

                // Table Header
                const colWidths = [20, 42, 18, 18, 16, 18, 18, 22];
                const headers = ['Date', 'Purpose / Route', 'Start', 'End', 'Miles', 'Tolls', 'Parking', 'Account'];

                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'bold');
                pdf.setFillColor(240, 240, 240);
                pdf.rect(margin, y, contentWidth, 7, 'F');

                let x = margin;
                headers.forEach((header, i) => {
                    pdf.text(header, x + 2, y + 5);
                    x += colWidths[i];
                });
                y += 8;

                // Table Rows
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(7);

                userReport.entries.forEach(entry => {
                    // Check if we need a new page
                    if (y > 240) {
                        pdf.addPage();
                        y = margin;
                    }

                    x = margin;
                    const rowHeight = 6;

                    pdf.text(formatDate(entry.trip_date), x + 2, y + 4);
                    x += colWidths[0];

                    // Purpose - wrap if needed
                    const purposeText = entry.business_purpose || getRouteText(entry.stops) || '—';
                    const truncatedPurpose = purposeText.length > 28 ? purposeText.substring(0, 25) + '...' : purposeText;
                    pdf.text(truncatedPurpose, x + 2, y + 4);
                    x += colWidths[1];

                    // Odometer Start
                    pdf.text(entry.odometer_start != null ? String(entry.odometer_start) : '—', x + 2, y + 4);
                    x += colWidths[2];

                    // Odometer End
                    pdf.text(entry.odometer_end != null ? String(entry.odometer_end) : '—', x + 2, y + 4);
                    x += colWidths[3];

                    pdf.text(String(entry.calculated_miles), x + 2, y + 4);
                    x += colWidths[4];

                    pdf.text(entry.tolls > 0 ? formatCurrency(entry.tolls) : '—', x + 2, y + 4);
                    x += colWidths[5];

                    pdf.text(entry.parking > 0 ? formatCurrency(entry.parking) : '—', x + 2, y + 4);
                    x += colWidths[6];

                    pdf.text(entry.account_code || '—', x + 2, y + 4);

                    // Draw row border
                    pdf.setDrawColor(200, 200, 200);
                    pdf.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

                    y += rowHeight;
                });

                y += 10;

                // Totals Section
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'bold');

                const totalsStartX = pageWidth - margin - 70;

                pdf.text('TOTALS:', totalsStartX, y);
                y += 6;

                pdf.setFont('helvetica', 'normal');
                pdf.text(`Total Miles: ${userReport.total_miles}`, totalsStartX, y);
                y += 5;

                pdf.text(`Total Tolls: ${formatCurrency(userReport.total_tolls)}`, totalsStartX, y);
                y += 5;

                pdf.text(`Total Parking: ${formatCurrency(userReport.total_parking)}`, totalsStartX, y);
                y += 8;

                // Payout Section (if enabled)
                if (includePayout) {
                    const mileageReimbursement = userReport.total_miles * rate;
                    const totalReimbursement = mileageReimbursement + userReport.total_tolls + userReport.total_parking;

                    pdf.setFont('helvetica', 'bold');
                    pdf.text(`Rate: ${formatCurrency(rate)}/mile`, totalsStartX, y);
                    y += 5;

                    pdf.text(`Mileage Payout: ${formatCurrency(mileageReimbursement)}`, totalsStartX, y);
                    y += 8;

                    pdf.setFontSize(12);
                    pdf.setFillColor(230, 255, 230);
                    pdf.rect(totalsStartX - 5, y - 5, 75, 10, 'F');
                    pdf.text(`TOTAL DUE: ${formatCurrency(totalReimbursement)}`, totalsStartX, y + 2);
                    y += 15;
                }

                // Signature Section
                y = Math.max(y, 200);

                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');

                // Employee Signature
                pdf.text('Employee Signature:', margin, y);
                pdf.line(margin + 40, y, margin + 120, y);
                pdf.text('Date:', margin + 125, y);
                pdf.line(margin + 140, y, pageWidth - margin, y);

                y += 15;

                // Supervisor Signature
                pdf.text('Supervisor Signature:', margin, y);
                pdf.line(margin + 42, y, margin + 120, y);
                pdf.text('Date:', margin + 125, y);
                pdf.line(margin + 140, y, pageWidth - margin, y);

                // Footer
                pdf.setFontSize(7);
                pdf.setFont('helvetica', 'italic');
                pdf.text(
                    `Generated on ${new Date().toLocaleDateString('en-US')} at ${new Date().toLocaleTimeString('en-US')}`,
                    pageWidth / 2,
                    pdf.internal.pageSize.getHeight() - 10,
                    { align: 'center' }
                );
            });

            // Download
            const filename = `Mileage_Report_${dateFrom}_to_${dateTo}.pdf`;
            pdf.save(filename);
        } catch (err) {
            console.error('Failed to generate PDF:', err);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    // Calculate grand totals
    const grandTotals = reportData.reduce((acc, user) => ({
        miles: acc.miles + user.total_miles,
        tolls: acc.tolls + user.total_tolls,
        parking: acc.parking + user.total_parking,
        entries: acc.entries + user.entries.length
    }), { miles: 0, tolls: 0, parking: 0, entries: 0 });

    const rate = parseFloat(settings.rate_per_mile) || 0;
    const grandMileageReimbursement = grandTotals.miles * rate;
    const grandTotalReimbursement = grandMileageReimbursement + grandTotals.tolls + grandTotals.parking;

    return (
        <div>
            {/* Report Configuration */}
            <Card className="ap-mb-6">
                <Card.Body>
                    <h2 className="ap-text-lg ap-font-semibold ap-text-gray-800 ap-mb-4 ap-flex ap-items-center ap-gap-2">
                        <HiOutlineDocumentArrowDown className="ap-w-5 ap-h-5 ap-text-blue-600" />
                        Generate Mileage Report
                    </h2>

                <div className="ap-grid ap-grid-cols-1 md:ap-grid-cols-2 lg:ap-grid-cols-4 ap-gap-4 ap-mb-4">
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            <HiOutlineCalendar className="ap-w-4 ap-h-4 ap-inline ap-mr-1" />
                            Start Date
                        </label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500"
                        />
                    </div>
                    <div>
                        <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-1">
                            <HiOutlineCalendar className="ap-w-4 ap-h-4 ap-inline ap-mr-1" />
                            End Date
                        </label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            className="ap-w-full ap-px-3 ap-py-2 ap-border ap-border-gray-300 ap-rounded-lg focus:ap-ring-2 focus:ap-ring-blue-500"
                        />
                    </div>

                    {canViewAll && (
                        <div className="md:ap-col-span-2">
                            <label className="ap-block ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">
                                <HiOutlineUserGroup className="ap-w-4 ap-h-4 ap-inline ap-mr-1" />
                                Employees ({selectedUsers.length} selected, leave empty for all)
                            </label>
                            <div className="ap-border ap-border-gray-200 ap-rounded-lg ap-overflow-hidden">
                                <div className="ap-p-2 ap-border-b ap-border-gray-200 ap-bg-gray-50">
                                    <div className="ap-relative">
                                        <HiOutlineMagnifyingGlass className="ap-absolute ap-left-3 ap-top-1/2 -ap-translate-y-1/2 ap-w-4 ap-h-4 ap-text-gray-400" />
                                        <input
                                            type="text"
                                            value={userSearch}
                                            onChange={(e) => setUserSearch(e.target.value)}
                                            placeholder="Search employees... (type to find archived)"
                                            className="ap-w-full ap-pl-9 ap-pr-3 ap-py-2 ap-text-sm ap-rounded ap-border ap-border-gray-200 focus:ap-border-blue-500 focus:ap-ring-1 focus:ap-ring-blue-500/20"
                                        />
                                    </div>
                                </div>
                                <div className="ap-max-h-48 ap-overflow-y-auto">
                                    {filteredUsers.length === 0 ? (
                                        <div className="ap-p-3 ap-text-sm ap-text-gray-500 ap-text-center">
                                            No employees found
                                        </div>
                                    ) : (
                                        filteredUsers.map(user => {
                                            const isSelected = selectedUsers.includes(user.id);
                                            return (
                                            <label
                                                key={user.id}
                                                className={`ap-flex ap-items-center ap-gap-3 ap-px-3 ap-py-2.5 hover:ap-bg-gray-50 ap-cursor-pointer ap-border-b ap-border-gray-100 last:ap-border-b-0 ${
                                                    isSelected ? 'ap-bg-blue-50' : ''
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleUser(user.id)}
                                                    className="ap-w-4 ap-h-4 ap-rounded ap-border-gray-300 ap-text-blue-600 focus:ap-ring-blue-500"
                                                />
                                                <span className={`ap-text-sm ap-flex-1 ${user.archived ? 'ap-text-gray-400' : 'ap-text-gray-700'}`}>
                                                    {user.display_name}
                                                    {user.archived && <span className="ap-ml-2 ap-text-xs ap-text-orange-500">(archived)</span>}
                                                </span>
                                                {isSelected && (
                                                    <HiOutlineCheck className="ap-w-4 ap-h-4 ap-text-blue-600 ap-flex-shrink-0" />
                                                )}
                                            </label>
                                        );})
                                    )}
                                </div>
                            </div>
                            {selectedUsers.length > 0 && (
                                <Button
                                    type="button"
                                    onClick={() => setSelectedUsers([])}
                                    variant="ghost"
                                    size="xs"
                                    className="!ap-text-blue-600 hover:!ap-text-blue-700 !ap-mt-1 !ap-p-0"
                                >
                                    Clear selection
                                </Button>
                            )}
                        </div>
                    )}

                    {!canViewAll && (
                        <div className="md:ap-col-span-2 ap-text-sm ap-text-gray-600 ap-bg-blue-50 ap-border ap-border-blue-200 ap-rounded-lg ap-px-3 ap-py-2">
                            📋 This report will show only your own mileage entries.
                        </div>
                    )}
                </div>

                <div className="ap-flex ap-flex-wrap ap-items-center ap-gap-4">
                    <label className="ap-flex ap-items-center ap-gap-2">
                        <input
                            type="checkbox"
                            checked={includePayout}
                            onChange={e => setIncludePayout(e.target.checked)}
                            className="ap-w-4 ap-h-4 ap-text-blue-600 ap-rounded focus:ap-ring-blue-500"
                        />
                        <span className="ap-text-sm ap-text-gray-700">
                            <HiOutlineCurrencyDollar className="ap-w-4 ap-h-4 ap-inline ap-mr-1" />
                            Include Payout Calculation (Rate: {formatCurrency(rate)}/mile)
                        </span>
                    </label>

                    <div className="ap-flex-1"></div>

                    <Button
                        onClick={generateReport}
                        disabled={loading || !dateFrom || !dateTo}
                        variant="primary"
                        className="!ap-flex !ap-items-center !ap-gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="ap-w-4 ap-h-4 ap-animate-spin ap-rounded-full ap-border-2 ap-border-white ap-border-t-transparent"></div>
                                Loading...
                            </>
                        ) : (
                            <>
                                <HiOutlineCheckCircle className="ap-w-5 ap-h-5" />
                                Preview Report
                            </>
                        )}
                    </Button>
                </div>
                </Card.Body>
            </Card>

            {/* Report Preview */}
            {reportData.length > 0 && (
                <>
                    {/* Grand Totals Summary */}
                    <div className="ap-bg-gradient-to-r ap-from-blue-50 ap-to-purple-50 ap-border ap-border-blue-200 ap-rounded-lg ap-p-6 ap-mb-6">
                        <h3 className="ap-text-lg ap-font-semibold ap-text-gray-800 ap-mb-4">Report Summary</h3>
                        <div className="ap-grid ap-grid-cols-2 md:ap-grid-cols-5 ap-gap-4">
                            <div className="ap-text-center">
                                <div className="ap-text-2xl ap-font-bold ap-text-blue-700">{reportData.length}</div>
                                <div className="ap-text-sm ap-text-gray-600">Employees</div>
                            </div>
                            <div className="ap-text-center">
                                <div className="ap-text-2xl ap-font-bold ap-text-blue-700">{grandTotals.entries}</div>
                                <div className="ap-text-sm ap-text-gray-600">Total Trips</div>
                            </div>
                            <div className="ap-text-center">
                                <div className="ap-text-2xl ap-font-bold ap-text-green-700">{grandTotals.miles}</div>
                                <div className="ap-text-sm ap-text-gray-600">Total Miles</div>
                            </div>
                            <div className="ap-text-center">
                                <div className="ap-text-2xl ap-font-bold ap-text-purple-700">{formatCurrency(grandTotals.tolls + grandTotals.parking)}</div>
                                <div className="ap-text-sm ap-text-gray-600">Tolls + Parking</div>
                            </div>
                            {includePayout && (
                                <div className="ap-text-center">
                                    <div className="ap-text-2xl ap-font-bold ap-text-emerald-700">{formatCurrency(grandTotalReimbursement)}</div>
                                    <div className="ap-text-sm ap-text-gray-600">Total Due</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Download Button */}
                    <div className="ap-flex ap-justify-end ap-mb-4">
                        <Button
                            onClick={downloadPDF}
                            disabled={generating}
                            variant="primary"
                            className="!ap-bg-green-600 hover:!ap-bg-green-700 !ap-flex !ap-items-center !ap-gap-2"
                        >
                            {generating ? (
                                <>
                                    <div className="ap-w-4 ap-h-4 ap-animate-spin ap-rounded-full ap-border-2 ap-border-white ap-border-t-transparent"></div>
                                    Generating PDF...
                                </>
                            ) : (
                                <>
                                    <HiOutlinePrinter className="ap-w-5 ap-h-5" />
                                    Download PDF Report
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Per-User Preview */}
                    <div className="ap-space-y-6">
                        {reportData.map(userReport => (
                            <Card key={userReport.user_id} padding="none" className="ap-overflow-hidden">
                                <div className="ap-bg-gray-50 ap-px-4 ap-py-3 ap-border-b ap-border-gray-200">
                                    <h3 className="ap-font-semibold ap-text-gray-800">{userReport.user_name}</h3>
                                    <div className="ap-text-sm ap-text-gray-500">
                                        {userReport.entries.length} trips • {userReport.total_miles} miles
                                        {includePayout && (
                                            <span className="ap-text-green-600 ap-ml-2">
                                                • Due: {formatCurrency(userReport.total_miles * rate + userReport.total_tolls + userReport.total_parking)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="ap-overflow-x-auto">
                                    <table className="ap-min-w-full ap-divide-y ap-divide-gray-200">
                                        <thead className="ap-bg-gray-50">
                                            <tr>
                                                <th className="ap-px-3 ap-py-2 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Date</th>
                                                <th className="ap-px-3 ap-py-2 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase ap-min-w-[200px]">Purpose</th>
                                                <th className="ap-px-3 ap-py-2 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Start</th>
                                                <th className="ap-px-3 ap-py-2 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">End</th>
                                                <th className="ap-px-3 ap-py-2 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Miles</th>
                                                <th className="ap-px-3 ap-py-2 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Tolls</th>
                                                <th className="ap-px-3 ap-py-2 ap-text-right ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Parking</th>
                                                <th className="ap-px-3 ap-py-2 ap-text-left ap-text-xs ap-font-medium ap-text-gray-500 ap-uppercase">Account</th>
                                            </tr>
                                        </thead>
                                        <tbody className="ap-divide-y ap-divide-gray-200">
                                            {userReport.entries.map(entry => (
                                                <tr key={entry.id} className="hover:ap-bg-gray-50">
                                                    <td className="ap-px-3 ap-py-2 ap-whitespace-nowrap ap-text-sm">{formatDate(entry.trip_date)}</td>
                                                    <td className="ap-px-3 ap-py-2 ap-text-sm ap-max-w-[300px]">
                                                        <div className="ap-whitespace-pre-wrap ap-break-words">
                                                            {entry.business_purpose || '—'}
                                                        </div>
                                                    </td>
                                                    <td className="ap-px-3 ap-py-2 ap-whitespace-nowrap ap-text-sm ap-text-right ap-text-gray-600">
                                                        {entry.odometer_start ?? '—'}
                                                    </td>
                                                    <td className="ap-px-3 ap-py-2 ap-whitespace-nowrap ap-text-sm ap-text-right ap-text-gray-600">
                                                        {entry.odometer_end ?? '—'}
                                                    </td>
                                                    <td className="ap-px-3 ap-py-2 ap-whitespace-nowrap ap-text-sm ap-text-right ap-font-semibold">{entry.calculated_miles}</td>
                                                    <td className="ap-px-3 ap-py-2 ap-whitespace-nowrap ap-text-sm ap-text-right">
                                                        {entry.tolls > 0 ? formatCurrency(entry.tolls) : '—'}
                                                    </td>
                                                    <td className="ap-px-3 ap-py-2 ap-whitespace-nowrap ap-text-sm ap-text-right">
                                                        {entry.parking > 0 ? formatCurrency(entry.parking) : '—'}
                                                    </td>
                                                    <td className="ap-px-3 ap-py-2 ap-whitespace-nowrap ap-text-sm ap-text-gray-500">
                                                        {entry.account_code || '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="ap-bg-gray-100">
                                            <tr className="ap-font-semibold">
                                                <td className="ap-px-3 ap-py-2 ap-text-sm" colSpan={4}>Totals</td>
                                                <td className="ap-px-3 ap-py-2 ap-text-sm ap-text-right">{userReport.total_miles}</td>
                                                <td className="ap-px-3 ap-py-2 ap-text-sm ap-text-right">{formatCurrency(userReport.total_tolls)}</td>
                                                <td className="ap-px-3 ap-py-2 ap-text-sm ap-text-right">{formatCurrency(userReport.total_parking)}</td>
                                                <td className="ap-px-3 ap-py-2 ap-text-sm"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                
                                {/* Budget Account Summary */}
                                {userReport.budget_accounts && Object.keys(userReport.budget_accounts).length > 0 && (
                                    <div className="ap-bg-gray-50 ap-px-4 ap-py-3 ap-border-t ap-border-gray-200">
                                        <h4 className="ap-text-sm ap-font-medium ap-text-gray-700 ap-mb-2">Budget Account Summary</h4>
                                        <div className="ap-grid ap-grid-cols-2 md:ap-grid-cols-3 ap-gap-2">
                                            {Object.entries(userReport.budget_accounts).map(([account, miles]) => (
                                                <div key={account} className="ap-bg-white ap-px-3 ap-py-2 ap-rounded ap-border ap-border-gray-200 ap-text-sm">
                                                    <div className="ap-font-medium ap-text-gray-800">{account}</div>
                                                    <div className="ap-text-gray-600">
                                                        {miles} miles
                                                        {includePayout && (
                                                            <span className="ap-text-green-600 ap-ml-2">
                                                                ({formatCurrency(miles * rate)})
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                </>
            )}

            {/* Empty State */}
            {reportData.length === 0 && !loading && dateFrom && dateTo && (
                <div className="ap-bg-gray-50 ap-border ap-border-gray-200 ap-rounded-lg ap-p-12 ap-text-center">
                    <HiOutlineDocumentArrowDown className="ap-w-16 ap-h-16 ap-text-gray-300 ap-mx-auto ap-mb-4" />
                    <h3 className="ap-text-lg ap-font-medium ap-text-gray-600 ap-mb-2">No Report Data</h3>
                    <p className="ap-text-gray-500">Click "Preview Report" to generate a report for the selected date range.</p>
                </div>
            )}
        </div>
    );
};

export default MileageReportGenerator;
