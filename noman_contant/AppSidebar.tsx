import {
  Home, Upload, Cpu, TreePine, BarChart3, Leaf, Brain, LayoutDashboard,
  TrendingUp, Eye, Layers, Map, ShieldAlert, GitCompare, LineChart, Database,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";

const pipelineItems = [
  { title: "Home",             url: "/",             icon: Home },
  { title: "Upload Data",      url: "/upload",       icon: Upload },
  { title: "Processing",       url: "/processing",   icon: Cpu },
  { title: "Segmentation",     url: "/segmentation", icon: TreePine },
  { title: "Features",         url: "/features",     icon: BarChart3 },
  { title: "Biomass & Carbon", url: "/biomass",      icon: Leaf },
  { title: "Prediction",       url: "/prediction",   icon: Brain },
  { title: "Inventory",        url: "/inventory",    icon: LayoutDashboard },
];

const analysisItems = [
  { title: "Overview",         url: "/analysis/overview",       icon: Eye },
  { title: "Species Analysis", url: "/analysis/species",        icon: Layers },
  { title: "Spatial Map",      url: "/analysis/spatial-map",   icon: Map },
  { title: "Health & Risk",    url: "/analysis/health-risk",   icon: ShieldAlert },
  { title: "Forest Change",    url: "/analysis/forest-change", icon: GitCompare },
  { title: "Seasonal Growth",  url: "/analysis/seasonal-growth", icon: LineChart },
  { title: "Sector Growth",    url: "/sector-growth",          icon: TrendingUp },
  { title: "Data Manager",     url: "/analysis/data-manager",  icon: Database },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`px-4 py-5 ${collapsed ? "px-2" : ""}`}>
          <div className="flex items-center gap-2">
            <TreePine className="h-7 w-7 text-sidebar-primary shrink-0" />
            {!collapsed && (
              <span className="font-display text-sm font-bold text-sidebar-foreground leading-tight">
                Forest Inventory
              </span>
            )}
          </div>
        </div>

        {/* Pipeline */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            {!collapsed && "Pipeline"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {pipelineItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/60 rounded-lg transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Statistical Analysis */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">
            {!collapsed && "Statistical Analysis"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analysisItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={false}
                      className="hover:bg-sidebar-accent/60 rounded-lg transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
