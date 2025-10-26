// src/components/GraphView.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Pie, Doughnut, Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const API = "http://localhost:5000";

export default function GraphView() {
  const navigate = useNavigate();
  
  // Single Asset Stats
  const [stats, setStats] = useState(null);
  
  // Bulk Asset Stats
  const [bulkStats, setBulkStats] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // View mode state - 'single' or 'bulk'
  const [viewMode, setViewMode] = useState('single');

  // Filter options from database
  const [filterOptions, setFilterOptions] = useState({
    institutes: [],
    departments: [],
    categories: [],
    statuses: [],
    asset_names: [],
    assigned_types: [],
    locations: []
  });

  // Bulk filter options
  const [bulkFilterOptions, setBulkFilterOptions] = useState({
    institutes: [],
    departments: [],
    categories: []
  });

  // Single Asset Filters
  const [filters, setFilters] = useState({
    institute: "",
    department: "",
    category: "",
    status: "",
    asset_name: "",
    assigned_type: "",
    location: ""
  });

  // Bulk Asset Filters
  const [bulkFilters, setBulkFilters] = useState({
    institute: "",
    department: "",
    category: ""
  });

  // Fetch filter options on component mount
  useEffect(() => {
    fetchFilterOptions();
    fetchBulkFilterOptions();
  }, []);

  // Fetch filter options from backend (for single assets)
  const fetchFilterOptions = async () => {
    try {
      const res = await fetch(`${API}/api/assets/filter-options`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch filter options");

      const data = await res.json();
      
      if (data.success) {
        setFilterOptions({
          institutes: data.institutes || [],
          departments: data.departments || [],
          categories: data.categories || [],
          statuses: data.statuses || [],
          asset_names: data.asset_names || [],
          assigned_types: data.assigned_types || [],
          locations: data.locations || []
        });
        console.log("Filter options loaded:", data);
      }
    } catch (err) {
      console.error("Error fetching filter options:", err);
    }
  };

  // Fetch bulk filter options
  const fetchBulkFilterOptions = async () => {
    try {
      const res = await fetch(`${API}/api/assets/filter-options`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch bulk filter options");

      const data = await res.json();
      
      if (data.success) {
        setBulkFilterOptions({
          institutes: data.institutes || [],
          departments: data.departments || [],
          categories: data.categories || []
        });
      }
    } catch (err) {
      console.error("Error fetching bulk filter options:", err);
    }
  };

  // Fetch SINGLE asset stats
  const fetchStats = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (filters.institute) params.set("institute", filters.institute);
      if (filters.department) params.set("department", filters.department);
      if (filters.category) params.set("category", filters.category);
      if (filters.status) params.set("status", filters.status);
      if (filters.asset_name) params.set("asset_name", filters.asset_name);
      if (filters.assigned_type) params.set("assigned_type", filters.assigned_type);
      if (filters.location) params.set("location", filters.location);

      const res = await fetch(`${API}/api/assets/stats?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch statistics");

      const data = await res.json();
      console.log("Single asset stats received:", data);
      
      if (data.success) {
        setStats(data);
      } else {
        setError(data.error || "Failed to load data");
      }
    } catch (err) {
      setError(err.message);
      console.error("Error fetching stats:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch BULK asset stats
  const fetchBulkStats = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();
      if (bulkFilters.institute) params.set("institute", bulkFilters.institute);
      if (bulkFilters.department) params.set("department", bulkFilters.department);
      if (bulkFilters.category) params.set("category", bulkFilters.category);

      const res = await fetch(`${API}/api/assets/bulk-stats?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to fetch bulk statistics");

      const data = await res.json();
      console.log("Bulk asset stats received:", data);
      
      if (data.success) {
        setBulkStats(data);
      } else {
        setError(data.error || "Failed to load bulk data");
      }
    } catch (err) {
      setError(err.message);
      console.error("Error fetching bulk stats:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats when filters or view mode changes
  useEffect(() => {
    if (viewMode === 'single') {
      fetchStats();
    } else if (viewMode === 'bulk') {
      fetchBulkStats();
    }
  }, [filters, bulkFilters, viewMode]);

  // Prepare chart data helper
  const prepareChartData = (dataArray, label) => {
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
      '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
    ];

    return {
      labels: dataArray.map(item => item._id || "Unknown"),
      datasets: [{
        label: label,
        data: dataArray.map(item => item.count),
        backgroundColor: colors.slice(0, dataArray.length),
        borderWidth: 1,
      }],
    };
  };

  // Prepare simple date data (total assets per date)
  const prepareDateData = (assetsByDate) => {
    if (!assetsByDate || assetsByDate.length === 0) {
      console.warn("No date data available");
      return null;
    }

    const sortedData = [...assetsByDate].sort((a, b) => a._id.localeCompare(b._id));

    return {
      labels: sortedData.map(item => item._id),
      datasets: [
        {
          label: 'Total Assets',
          data: sortedData.map(item => item.count),
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
        }
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
      },
    },
  };

  const timeSeriesOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom',
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  const selectStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    backgroundColor: 'white',
    fontSize: '14px',
    color: '#1f2937',
    cursor: 'pointer',
    outline: 'none',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '16px',
    paddingRight: '36px'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    marginBottom: '8px',
    color: '#374151'
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)', padding: '24px' }}>
        {/* Header with Toggle Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1f2937', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <span>📊</span> Asset Analytics Dashboard
            </h2>
            
            {/* Toggle Buttons */}
            <div style={{ display: 'flex', gap: '8px', border: '1px solid #d1d5db', borderRadius: '8px', padding: '4px', backgroundColor: '#f9fafb' }}>
              <button
                onClick={() => setViewMode('single')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: viewMode === 'single' ? '#3b82f6' : 'transparent',
                  color: viewMode === 'single' ? 'white' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                For Single Asset
              </button>
              <button
                onClick={() => setViewMode('bulk')}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: viewMode === 'bulk' ? '#3b82f6' : 'transparent',
                  color: viewMode === 'bulk' ? 'white' : '#6b7280',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                For Bulk Asset
              </button>
            </div>
          </div>

          <button
            onClick={() => navigate(-1)}
            style={{
              padding: '10px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              backgroundColor: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              transition: 'background-color 0.15s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '20px', width: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{
              display: 'inline-block',
              width: '48px',
              height: '48px',
              border: '3px solid #e5e7eb',
              borderTop: '3px solid #4f46e5',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading statistics...</p>
          </div>
        )}

        {error && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div style={{
              color: '#dc2626',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <p style={{ fontWeight: '600', margin: '0 0 8px 0' }}>Error:</p>
              <p style={{ margin: 0 }}>{error}</p>
            </div>
          </div>
        )}

        {/* ==================== BULK ASSET VIEW ==================== */}
        {viewMode === 'bulk' && !loading && !error && (
          <>
            {/* Bulk Filters - 3 DROPDOWNS */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
              padding: '20px',
              background: 'linear-gradient(to right, #fef3c7, #fed7aa)',
              borderRadius: '12px',
              border: '1px solid #fcd34d'
            }}>
              {/* Institute */}
              <div>
                <label style={labelStyle}>Institute</label>
                <select
                  style={selectStyle}
                  value={bulkFilters.institute}
                  onChange={(e) => setBulkFilters({ ...bulkFilters, institute: e.target.value })}
                >
                  <option value="">All institutes</option>
                  {bulkFilterOptions.institutes.map((institute) => (
                    <option key={institute} value={institute}>{institute}</option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div>
                <label style={labelStyle}>Department</label>
                <select
                  style={selectStyle}
                  value={bulkFilters.department}
                  onChange={(e) => setBulkFilters({ ...bulkFilters, department: e.target.value })}
                >
                  <option value="">All departments</option>
                  {bulkFilterOptions.departments.map((department) => (
                    <option key={department} value={department}>{department}</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label style={labelStyle}>Category</label>
                <select
                  style={selectStyle}
                  value={bulkFilters.category}
                  onChange={(e) => setBulkFilters({ ...bulkFilters, category: e.target.value })}
                >
                  <option value="">All categories</option>
                  {bulkFilterOptions.categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            {bulkStats && (
              <>
                {/* Bulk Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div style={{
                    padding: '24px',
                    background: 'linear-gradient(to bottom right, #dbeafe, #bfdbfe)',
                    border: '1px solid #93c5fd',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <h3 style={{ fontSize: '13px', fontWeight: '500', color: '#1e3a8a', margin: '0 0 8px 0' }}>Total Bulk QR Codes</h3>
                        <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#1d4ed8', margin: 0 }}>{bulkStats.total_bulk_assets}</p>
                      </div>
                      <div style={{ color: '#93c5fd', opacity: 0.5 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '48px', width: '48px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    padding: '24px',
                    background: 'linear-gradient(to bottom right, #d1fae5, #a7f3d0)',
                    border: '1px solid #6ee7b7',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <h3 style={{ fontSize: '13px', fontWeight: '500', color: '#065f46', margin: '0 0 8px 0' }}>Linked (Data Added)</h3>
                        <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#059669', margin: 0 }}>{bulkStats.linked_count}</p>
                      </div>
                      <div style={{ color: '#6ee7b7', opacity: 0.5 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '48px', width: '48px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    padding: '24px',
                    background: 'linear-gradient(to bottom right, #fef3c7, #fde68a)',
                    border: '1px solid #fcd34d',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <h3 style={{ fontSize: '13px', fontWeight: '500', color: '#78350f', margin: '0 0 8px 0' }}>Not Linked (QR Only)</h3>
                        <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#b45309', margin: 0 }}>{bulkStats.not_linked_count}</p>
                      </div>
                      <div style={{ color: '#fcd34d', opacity: 0.5 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '48px', width: '48px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bulk Assets by Date Chart (Full Width) */}
                {bulkStats.assets_by_date && bulkStats.assets_by_date.length > 0 && (() => {
                  const dateData = prepareDateData(bulkStats.assets_by_date);
                  return dateData ? (
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '24px',
                      backgroundColor: 'white',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      marginBottom: '24px'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        marginBottom: '16px',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#f59e0b' }}>📅</span>
                        Bulk QR Codes Generated by Date
                      </h3>
                      <Line data={dateData} options={timeSeriesOptions} />
                    </div>
                  ) : null;
                })()}

                {/* Bulk Charts Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
                  
                  {/* Link Status - Pie Chart (PRIMARY) */}
                  <div style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '24px',
                    backgroundColor: 'white',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      marginBottom: '16px',
                      color: '#374151',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ color: '#10b981' }}>🔗</span>
                      Link Status (Linked vs Not Linked)
                    </h3>
                    <Pie
                      data={{
                        labels: ['Linked', 'Not Linked'],
                        datasets: [{
                          data: [bulkStats.linked_count, bulkStats.not_linked_count],
                          backgroundColor: ['#10b981', '#f59e0b'],
                          borderWidth: 2,
                          borderColor: '#fff',
                        }]
                      }}
                      options={chartOptions}
                    />
                  </div>

                  {/* Bulk by Category - Bar Chart */}
                  {bulkStats.by_category && bulkStats.by_category.length > 0 && (
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '24px',
                      backgroundColor: 'white',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        marginBottom: '16px',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#3b82f6' }}>📦</span>
                        Linked Assets by Category
                      </h3>
                      <Bar data={prepareChartData(bulkStats.by_category, "Linked Assets")} options={chartOptions} />
                    </div>
                  )}

                  {/* Bulk by Institute - Doughnut Chart */}
                  {bulkStats.by_institute && bulkStats.by_institute.length > 0 && (
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '24px',
                      backgroundColor: 'white',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        marginBottom: '16px',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#6366f1' }}>🎓</span>
                        Bulk QR Codes by Institute
                      </h3>
                      <Doughnut data={prepareChartData(bulkStats.by_institute, "QR Codes")} options={chartOptions} />
                    </div>
                  )}

                  {/* Bulk by Department - Bar Chart */}
                  {bulkStats.by_department && bulkStats.by_department.length > 0 && (
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '24px',
                      backgroundColor: 'white',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        marginBottom: '16px',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#8b5cf6' }}>🏢</span>
                        Bulk QR Codes by Department
                      </h3>
                      <Bar data={prepareChartData(bulkStats.by_department, "QR Codes")} options={chartOptions} />
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ==================== SINGLE ASSET VIEW ==================== */}
        {viewMode === 'single' && !loading && !error && (
          <>
            {/* Single Asset Filters - 7 DROPDOWNS */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '24px',
              padding: '20px',
              background: 'linear-gradient(to right, #eef2ff, #f3e8ff)',
              borderRadius: '12px',
              border: '1px solid #e0e7ff'
            }}>
              {/* Institute */}
              <div>
                <label style={labelStyle}>Institute</label>
                <select
                  style={selectStyle}
                  value={filters.institute}
                  onChange={(e) => setFilters({ ...filters, institute: e.target.value })}
                >
                  <option value="">All institutes</option>
                  {filterOptions.institutes.map((institute) => (
                    <option key={institute} value={institute}>{institute}</option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div>
                <label style={labelStyle}>Department</label>
                <select
                  style={selectStyle}
                  value={filters.department}
                  onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                >
                  <option value="">All departments</option>
                  {filterOptions.departments.map((department) => (
                    <option key={department} value={department}>{department}</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label style={labelStyle}>Category</label>
                <select
                  style={selectStyle}
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                >
                  <option value="">All categories</option>
                  {filterOptions.categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label style={labelStyle}>Status</label>
                <select
                  style={selectStyle}
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <option value="">All statuses</option>
                  {filterOptions.statuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>

              {/* Asset Name */}
              <div>
                <label style={labelStyle}>Asset Name</label>
                <select
                  style={selectStyle}
                  value={filters.asset_name}
                  onChange={(e) => setFilters({ ...filters, asset_name: e.target.value })}
                >
                  <option value="">All asset names</option>
                  {filterOptions.asset_names.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              {/* Assigned Type */}
              <div>
                <label style={labelStyle}>Assigned Type</label>
                <select
                  style={selectStyle}
                  value={filters.assigned_type}
                  onChange={(e) => setFilters({ ...filters, assigned_type: e.target.value })}
                >
                  <option value="">All assigned types</option>
                  {filterOptions.assigned_types.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              {/* Location */}
              <div>
                <label style={labelStyle}>Location</label>
                <select
                  style={selectStyle}
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                >
                  <option value="">All locations</option>
                  {filterOptions.locations.map((location) => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
            </div>

            {stats && (
              <>
                {/* Single Asset Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div style={{
                    padding: '24px',
                    background: 'linear-gradient(to bottom right, #dbeafe, #bfdbfe)',
                    border: '1px solid #93c5fd',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <h3 style={{ fontSize: '13px', fontWeight: '500', color: '#1e3a8a', margin: '0 0 8px 0' }}>Total Assets</h3>
                        <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#1d4ed8', margin: 0 }}>{stats.total_assets}</p>
                      </div>
                      <div style={{ color: '#93c5fd', opacity: 0.5 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '48px', width: '48px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    padding: '24px',
                    background: 'linear-gradient(to bottom right, #d1fae5, #a7f3d0)',
                    border: '1px solid #6ee7b7',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <h3 style={{ fontSize: '13px', fontWeight: '500', color: '#065f46', margin: '0 0 8px 0' }}>Verified</h3>
                        <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#059669', margin: 0 }}>{stats.verified_stats.verified}</p>
                      </div>
                      <div style={{ color: '#6ee7b7', opacity: 0.5 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '48px', width: '48px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div style={{
                    padding: '24px',
                    background: 'linear-gradient(to bottom right, #fef3c7, #fde68a)',
                    border: '1px solid #fcd34d',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <h3 style={{ fontSize: '13px', fontWeight: '500', color: '#78350f', margin: '0 0 8px 0' }}>Unverified</h3>
                        <p style={{ fontSize: '36px', fontWeight: 'bold', color: '#b45309', margin: 0 }}>{stats.verified_stats.unverified}</p>
                      </div>
                      <div style={{ color: '#fcd34d', opacity: 0.5 }}>
                        <svg xmlns="http://www.w3.org/2000/svg" style={{ height: '48px', width: '48px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Single Assets by Date Chart (Full Width) */}
                {stats.assets_by_date && stats.assets_by_date.length > 0 && (() => {
                  const dateData = prepareDateData(stats.assets_by_date);
                  return dateData ? (
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '24px',
                      backgroundColor: 'white',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                      marginBottom: '24px'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        marginBottom: '16px',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#6366f1' }}>📅</span>
                        Total Assets Added by Date
                      </h3>
                      <Line data={dateData} options={timeSeriesOptions} />
                    </div>
                  ) : null;
                })()}

                {/* Single Asset Charts Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
                  {/* Assets by Category */}
                  {stats.by_category && stats.by_category.length > 0 && (
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '24px',
                      backgroundColor: 'white',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        marginBottom: '16px',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#3b82f6' }}>📦</span>
                        Assets by Category
                      </h3>
                      <Bar data={prepareChartData(stats.by_category, "Assets")} options={chartOptions} />
                    </div>
                  )}

                  {/* Assets by Status */}
                  {stats.by_status && stats.by_status.length > 0 && (
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '24px',
                      backgroundColor: 'white',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        marginBottom: '16px',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#10b981' }}>✅</span>
                        Assets by Status
                      </h3>
                      <Pie data={prepareChartData(stats.by_status, "Assets")} options={chartOptions} />
                    </div>
                  )}

                  {/* Assets by Department */}
                  {stats.by_department && stats.by_department.length > 0 && (
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '24px',
                      backgroundColor: 'white',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        marginBottom: '16px',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#8b5cf6' }}>🏢</span>
                        Assets by Department
                      </h3>
                      <Bar data={prepareChartData(stats.by_department, "Assets")} options={chartOptions} />
                    </div>
                  )}

                  {/* Assets by Institute */}
                  {stats.by_institute && stats.by_institute.length > 0 && (
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '24px',
                      backgroundColor: 'white',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        marginBottom: '16px',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#6366f1' }}>🎓</span>
                        Assets by Institute
                      </h3>
                      <Doughnut data={prepareChartData(stats.by_institute, "Assets")} options={chartOptions} />
                    </div>
                  )}

                  {/* Single Assets by Assigned Type */}
                  {stats.by_assigned_type && stats.by_assigned_type.length > 0 && (
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '24px',
                      backgroundColor: 'white',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        marginBottom: '16px',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#f97316' }}>🔖</span>
                        Single Assets by Type (General/Individual)
                      </h3>
                      <Doughnut data={prepareChartData(stats.by_assigned_type, "Single Assets")} options={chartOptions} />
                    </div>
                  )}

                  {/* Top Locations */}
                  {stats.by_location && stats.by_location.length > 0 && (
                    <div style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: '12px',
                      padding: '24px',
                      backgroundColor: 'white',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                    }}>
                      <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        marginBottom: '16px',
                        color: '#374151',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <span style={{ color: '#ef4444' }}>📍</span>
                        Locations
                      </h3>
                      <Bar data={prepareChartData(stats.by_location, "Assets")} options={chartOptions} />
                    </div>
                  )}

                  {/* Verification Status */}
                  <div style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    padding: '24px',
                    backgroundColor: 'white',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                  }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      marginBottom: '16px',
                      color: '#374151',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span style={{ color: '#eab308' }}>🔍</span>
                      Verification Status
                    </h3>
                    <Doughnut
                      data={{
                        labels: ['Verified', 'Unverified'],
                        datasets: [{
                          data: [stats.verified_stats.verified, stats.verified_stats.unverified],
                          backgroundColor: ['#10b981', '#f59e0b'],
                          borderWidth: 2,
                          borderColor: '#fff',
                        }]
                      }}
                      options={chartOptions}
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
