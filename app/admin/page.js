"use client";
import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../providers/AuthProvider";
import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Loader, Plus, Save, Trash2, UserPlus } from "lucide-react";
import { collection, query, where, getDocs, orderBy, limit, startAfter, addDoc, updateDoc, doc, getDoc, Timestamp, getFirestore } from "firebase/firestore";
import { db } from "../firebase/database";
import SimpleSparkline from "../components/SimpleSparkline";
import { toast } from "sonner";

// Admin emails
const ADMIN_EMAILS = ["jamiegray2234@gmail.com"];

export default function AdminPage() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [adminEmails, setAdminEmails] = useState([]);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  
  // Analytics data
  const [pageViewsData, setPageViewsData] = useState([]);
  const [pagesCreatedData, setPagesCreatedData] = useState([]);
  const [repliesCreatedData, setRepliesCreatedData] = useState([]);
  const [accountsCreatedData, setAccountsCreatedData] = useState([]);
  const [deviceUsageData, setDeviceUsageData] = useState({
    desktop: [],
    mobileBrowser: [],
    mobilePwa: []
  });
  const [topLinkedPages, setTopLinkedPages] = useState([]);
  
  // Time range state
  const [timeRange, setTimeRange] = useState('all');
  
  // Check if user is admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (authLoading) return;
      
      if (!user) {
        router.push("/");
        return;
      }
      
      // Check if user's email is in the admin list
      if (ADMIN_EMAILS.includes(user.email)) {
        setIsAdmin(true);
        setIsLoading(false);
        
        // Load admin emails from Firestore
        await loadAdminEmails();
        
        // Load analytics data
        await loadAnalyticsData();
      } else {
        // Check if user's email is in the database admin list
        const adminRef = collection(db, "admins");
        const q = query(adminRef, where("email", "==", user.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          setIsAdmin(true);
        } else {
          router.push("/");
        }
        
        setIsLoading(false);
      }
    };
    
    checkAdmin();
  }, [user, authLoading, router]);
  
  // Load admin emails from Firestore
  const loadAdminEmails = async () => {
    try {
      const adminRef = collection(db, "admins");
      const querySnapshot = await getDocs(adminRef);
      
      const emails = [];
      querySnapshot.forEach((doc) => {
        emails.push(doc.data().email);
      });
      
      setAdminEmails([...ADMIN_EMAILS, ...emails.filter(email => !ADMIN_EMAILS.includes(email))]);
    } catch (error) {
      console.error("Error loading admin emails:", error);
    }
  };
  
  // Add a new admin
  const addAdmin = async () => {
    if (!newAdminEmail || !newAdminEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    if (adminEmails.includes(newAdminEmail)) {
      toast.error("This email is already an admin");
      return;
    }
    
    setIsAddingAdmin(true);
    
    try {
      // Add to Firestore
      await addDoc(collection(db, "admins"), {
        email: newAdminEmail,
        addedBy: user.email,
        addedAt: new Date().toISOString()
      });
      
      // Update local state
      setAdminEmails([...adminEmails, newAdminEmail]);
      setNewAdminEmail("");
      toast.success("Admin added successfully");
    } catch (error) {
      console.error("Error adding admin:", error);
      toast.error("Failed to add admin");
    } finally {
      setIsAddingAdmin(false);
    }
  };
  
  // Load analytics data
  const loadAnalyticsData = async () => {
    try {
      // Generate sample data for now
      // In a real implementation, this would fetch from Firestore
      generateSampleData();
      
      // Load top linked pages
      await loadTopLinkedPages();
    } catch (error) {
      console.error("Error loading analytics data:", error);
    }
  };
  
  // Generate sample data for analytics
  const generateSampleData = () => {
    // Generate 30 days of data
    const days = 30;
    const now = new Date();
    
    // Page views - increasing trend with weekend dips
    const pageViews = Array(days).fill(0).map((_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (days - i - 1));
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const baseValue = 100 + i * 5; // Increasing trend
      return Math.round(baseValue * (isWeekend ? 0.7 : 1) * (0.9 + Math.random() * 0.2));
    });
    
    // Pages created - steady with occasional spikes
    const pagesCreated = Array(days).fill(0).map((_, i) => {
      const spike = i % 7 === 3 ? 2 : 1; // Spike every 7 days
      return Math.round((10 + Math.random() * 5) * spike);
    });
    
    // Replies created - correlated with page views
    const repliesCreated = pageViews.map(views => Math.round(views * 0.2 * (0.8 + Math.random() * 0.4)));
    
    // Accounts created - steady growth
    const accountsCreated = Array(days).fill(0).map((_, i) => {
      return Math.round(5 + i * 0.2 + Math.random() * 3);
    });
    
    // Device usage - stacked area chart data
    const desktop = Array(days).fill(0).map((_, i) => {
      return Math.round(50 + Math.random() * 20);
    });
    
    const mobileBrowser = Array(days).fill(0).map((_, i) => {
      return Math.round(30 + Math.random() * 15);
    });
    
    const mobilePwa = Array(days).fill(0).map((_, i) => {
      return Math.round(10 + i * 0.5 + Math.random() * 5); // Growing trend for PWA
    });
    
    setPageViewsData(pageViews);
    setPagesCreatedData(pagesCreated);
    setRepliesCreatedData(repliesCreated);
    setAccountsCreatedData(accountsCreated);
    setDeviceUsageData({
      desktop,
      mobileBrowser,
      mobilePwa
    });
  };
  
  // Load top linked pages
  const loadTopLinkedPages = async () => {
    try {
      // In a real implementation, this would query Firestore for pages with link counts
      // For now, generate sample data
      const samplePages = [
        { id: 'page1', title: 'Getting Started Guide', linkCount: 42 },
        { id: 'page2', title: 'Frequently Asked Questions', linkCount: 37 },
        { id: 'page3', title: 'How to Format Text', linkCount: 29 },
        { id: 'page4', title: 'Community Guidelines', linkCount: 24 },
        { id: 'page5', title: 'Privacy Policy', linkCount: 21 },
        { id: 'page6', title: 'Terms of Service', linkCount: 18 },
        { id: 'page7', title: 'About WeWrite', linkCount: 15 },
        { id: 'page8', title: 'Markdown Cheatsheet', linkCount: 12 },
        { id: 'page9', title: 'Feature Requests', linkCount: 9 },
        { id: 'page10', title: 'Known Issues', linkCount: 7 }
      ];
      
      setTopLinkedPages(samplePages);
    } catch (error) {
      console.error("Error loading top linked pages:", error);
    }
  };
  
  // Handle time range change
  const handleTimeRangeChange = (range) => {
    setTimeRange(range);
    // In a real implementation, this would reload the data for the selected time range
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (!isAdmin) {
    return null; // Router will redirect
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <Tabs defaultValue="analytics">
        <TabsList className="mb-6">
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="admins">Manage Admins</TabsTrigger>
        </TabsList>
        
        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Page Views */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Page Views</span>
                  <div className="text-xs text-muted-foreground">
                    <button 
                      onClick={() => handleTimeRangeChange('all')} 
                      className={`px-1 ${timeRange === 'all' ? 'text-primary font-medium' : ''}`}
                    >
                      all
                    </button>
                    <span className="mx-1">|</span>
                    <button 
                      onClick={() => handleTimeRangeChange('24h')} 
                      className={`px-1 ${timeRange === '24h' ? 'text-primary font-medium' : ''}`}
                    >
                      24h
                    </button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-40">
                  <SimpleSparkline data={pageViewsData} height={160} />
                </div>
              </CardContent>
            </Card>
            
            {/* Pages Created */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Pages Created</span>
                  <div className="text-xs text-muted-foreground">
                    <button 
                      onClick={() => handleTimeRangeChange('all')} 
                      className={`px-1 ${timeRange === 'all' ? 'text-primary font-medium' : ''}`}
                    >
                      all
                    </button>
                    <span className="mx-1">|</span>
                    <button 
                      onClick={() => handleTimeRangeChange('24h')} 
                      className={`px-1 ${timeRange === '24h' ? 'text-primary font-medium' : ''}`}
                    >
                      24h
                    </button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-40">
                  <SimpleSparkline data={pagesCreatedData} height={160} />
                </div>
              </CardContent>
            </Card>
            
            {/* Replies Created */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Replies Created</span>
                  <div className="text-xs text-muted-foreground">
                    <button 
                      onClick={() => handleTimeRangeChange('all')} 
                      className={`px-1 ${timeRange === 'all' ? 'text-primary font-medium' : ''}`}
                    >
                      all
                    </button>
                    <span className="mx-1">|</span>
                    <button 
                      onClick={() => handleTimeRangeChange('24h')} 
                      className={`px-1 ${timeRange === '24h' ? 'text-primary font-medium' : ''}`}
                    >
                      24h
                    </button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-40">
                  <SimpleSparkline data={repliesCreatedData} height={160} />
                </div>
              </CardContent>
            </Card>
            
            {/* Accounts Created */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <span>Accounts Created</span>
                  <div className="text-xs text-muted-foreground">
                    <button 
                      onClick={() => handleTimeRangeChange('all')} 
                      className={`px-1 ${timeRange === 'all' ? 'text-primary font-medium' : ''}`}
                    >
                      all
                    </button>
                    <span className="mx-1">|</span>
                    <button 
                      onClick={() => handleTimeRangeChange('24h')} 
                      className={`px-1 ${timeRange === '24h' ? 'text-primary font-medium' : ''}`}
                    >
                      24h
                    </button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-40">
                  <SimpleSparkline data={accountsCreatedData} height={160} />
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Device Usage */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Device Usage</CardTitle>
              <CardDescription>Active users by device type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-60">
                {/* In a real implementation, this would be a stacked area chart */}
                <div className="flex h-full">
                  <div className="flex flex-col justify-end w-1/3 px-2">
                    <div className="text-center mb-2">Desktop</div>
                    <div className="h-40">
                      <SimpleSparkline data={deviceUsageData.desktop} height={160} color="#4CAF50" />
                    </div>
                  </div>
                  <div className="flex flex-col justify-end w-1/3 px-2">
                    <div className="text-center mb-2">Mobile Browser</div>
                    <div className="h-40">
                      <SimpleSparkline data={deviceUsageData.mobileBrowser} height={160} color="#2196F3" />
                    </div>
                  </div>
                  <div className="flex flex-col justify-end w-1/3 px-2">
                    <div className="text-center mb-2">Mobile PWA</div>
                    <div className="h-40">
                      <SimpleSparkline data={deviceUsageData.mobilePwa} height={160} color="#9C27B0" />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Top Linked Pages */}
          <Card>
            <CardHeader>
              <CardTitle>Top Linked Pages</CardTitle>
              <CardDescription>Pages with the most links pointing to them</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Rank</th>
                      <th className="text-left py-2 font-medium">Page Title</th>
                      <th className="text-right py-2 font-medium">Link Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topLinkedPages.map((page, index) => (
                      <tr key={page.id} className="border-b border-border/40 hover:bg-muted/50">
                        <td className="py-2">{index + 1}</td>
                        <td className="py-2">
                          <a href={`/${page.id}`} className="text-primary hover:underline">
                            {page.title}
                          </a>
                        </td>
                        <td className="py-2 text-right">{page.linkCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="admins">
          <Card>
            <CardHeader>
              <CardTitle>Manage Administrators</CardTitle>
              <CardDescription>Add or remove admin access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-2">Current Admins</h3>
                <ul className="space-y-2">
                  {adminEmails.map((email) => (
                    <li key={email} className="flex items-center justify-between p-2 border border-border/40 rounded-md">
                      <span>{email}</span>
                      {!ADMIN_EMAILS.includes(email) && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-2">Add New Admin</h3>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Email address"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                  />
                  <Button onClick={addAdmin} disabled={isAddingAdmin}>
                    {isAddingAdmin ? (
                      <Loader className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
