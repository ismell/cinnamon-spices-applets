/*
Copyright 2012 Renaud Delcoigne (Aka Sylfurd)

This file is part of HWMonitor

HWMonitor is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

Foobar is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
details.

You should have received a copy of the GNU General Public License along
with Foobar. If not, see http://www.gnu.org/licenses/.
*/

// 2019-10-15 : I added a version to metadata.json, please increase that 
// when making changes to this applet

const Applet = imports.ui.applet;
const Cinnamon = imports.gi.Cinnamon;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const PopupMenu = imports.ui.popupMenu;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const Settings = imports.ui.settings;
const UUID = "hwmonitor@sylfurd";

let gtopFailed = false;
let Providers;
let Graph;
let Support;

if (typeof require !== 'undefined') {
    Providers = require('./providers');
    Graph = require('./graph');
    Support = require('./support');
} else {
    Providers = imports.ui.appletManager.applets[UUID].providers;
    Graph = imports.ui.appletManager.applets[UUID].graph;
    Support = imports.ui.appletManager.applets[UUID].support;
}

Gettext.bindtextdomain(UUID, GLib.get_home_dir() + "/.local/share/locale");
function _(str) {
  return Gettext.dgettext(UUID, str)
}

let debug_once = true;
function debug_message_once(message) {    
    if (debug_once)
        global.logError("HWMONITOR : " + message);
    debug_once = false;
}

function debug_message(message) {
    global.logError("HWMONITOR : " + message);
}

function GraphicalHWMonitorApplet(metadata, orientation, panel_height, instance_id) {
    this._init(metadata, orientation, panel_height, instance_id);
}

GraphicalHWMonitorApplet.prototype = {
    __proto__: Applet.IconApplet.prototype,

    _init: function (metadata, orientation, panel_height, instance_id) {
        Applet.IconApplet.prototype._init.call(this, orientation, panel_height, instance_id);
        
        this.getOrientation(orientation); // Initialise for panel orientation
        this.panel_height = panel_height;
        this.graphs = [];

        if (gtopFailed) {
            this.set_applet_icon_path(metadata.path + "/icon.png");
            this.set_applet_tooltip(metadata.description);
            return;
        }

        this.itemOpenSysMon = new PopupMenu.PopupMenuItem(_("Open System Monitor"));        
        this.itemOpenSysMon.connect('activate', Lang.bind(this, this._runSysMonActivate));
        this._applet_context_menu.addMenuItem(this.itemOpenSysMon);

        this.itemReset = new PopupMenu.PopupMenuItem(_("Restart 'Graphical hardware monitor'"));        
        this.itemReset.connect('activate', Lang.bind(this, this.restartGHW));
        this._applet_context_menu.addMenuItem(this.itemReset);


        // Setup the applet settings 
        this.settings = new Settings.AppletSettings(this, metadata.uuid, instance_id);
        // General settings
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "frequency", "frequency", this.settingsChanged, null);
        
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "theme", "theme", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "border_color", "border_color", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "background_color1", "background_color1", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "background_color2", "background_color2", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "label_color", "label_color", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "label_size", "label_size", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "detail_label_color", "detail_label_color", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "detail_label_size", "detail_label_size", this.settingsChanged, null);

        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "theme_data", "theme_data", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "graph_color1", "graph_color1", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "graph_color2", "graph_color2", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "graph_color3", "graph_color3", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "graph_color4", "graph_color4", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "graph_offset2", "graph_offset2", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "graph_offset3", "graph_offset3", this.settingsChanged, null);
        // CPU settings
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "cpu_enable_graph", "cpu_enable_graph", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "cpu_size", "cpu_size", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "cpu_use_custom_label", "cpu_use_custom_label", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "cpu_custom_label", "cpu_custom_label", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "cpu_show_detail_label", "cpu_show_detail_label", this.settingsChanged, null);
        // MEM settings
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "mem_enable_graph", "mem_enable_graph", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "mem_size", "mem_size", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "mem_use_custom_label", "mem_use_custom_label", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "mem_custom_label", "mem_custom_label", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "mem_show_detail_label", "mem_show_detail_label", this.settingsChanged, null);
        // NET (in) settings
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "netin_enable_graph", "netin_enable_graph", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "netin_size", "netin_size", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "netin_speed", "netin_speed", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "netin_use_custom_label", "netin_use_custom_label", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "netin_custom_label", "netin_custom_label", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "netin_linlog", "netin_linlog", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "netin_show_detail_label", "netin_show_detail_label", this.settingsChanged, null);
        // NET (out) settings
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "netout_enable_graph", "netout_enable_graph", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "netout_size", "netout_size", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "netout_speed", "netout_speed", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "netout_use_custom_label", "netout_use_custom_label", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "netout_custom_label", "netout_custom_label", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "netout_linlog", "netout_linlog", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "netout_show_detail_label", "netout_show_detail_label", this.settingsChanged, null);
        // DISK (read) settings
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "diskread_enable_graph", "diskread_enable_graph", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "diskread_size", "diskread_size", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "diskread_mount_dir", "diskread_mount_dir", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "diskread_use_custom_label", "diskread_use_custom_label", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "diskread_custom_label", "diskread_custom_label", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "diskread_show_detail_label", "diskread_show_detail_label", this.settingsChanged, null);
        // DISK (write) settings
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "diskwrite_enable_graph", "diskwrite_enable_graph", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "diskwrite_size", "diskwrite_size", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "diskwrite_mount_dir", "diskwrite_mount_dir", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "diskwrite_use_custom_label", "diskwrite_use_custom_label", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "diskwrite_custom_label", "diskwrite_custom_label", this.settingsChanged, null);
        this.settings.bindProperty(Settings.BindingDirection.BIDIRECTIONAL, "diskwrite_show_detail_label", "diskwrite_show_detail_label", this.settingsChanged, null);
        
        this.createThemeObject();

        this.createAppletArea();

        this.actor.set_offscreen_redirect(Clutter.OffscreenRedirect.ALWAYS);
        this.addUpdateLoop(this.frequency);

    },

    createAppletArea: function(){
        this.graphs = [];
        if (this.isHorizontal)
            this.appletArea = new Support.AppletArea(this, this.isHorizontal,0, this.panel_height);
        else
            this.appletArea = new Support.AppletArea(this, this.isHorizontal,this.panel_height, 0);

        // Add CPU graph
        if (this.cpu_enable_graph) {
            let cpuGraphArea = null;
            if (this.isHorizontal)
                cpuGraphArea = this.appletArea.addGraph(this.cpu_size, this.panel_height);
            else
                cpuGraphArea = this.appletArea.addGraph(this.panel_height, this.cpu_size);

            let cpuProvider =  new Providers.CpuDataProvider();
            this.graphs.push(new Graph.Graph(cpuProvider, cpuGraphArea, this.theme_object, this.cpu_show_detail_label));
        }

        // Add MEM graph
        if (this.mem_enable_graph) {
            let memGraphArea = null;
            if (this.isHorizontal)
                memGraphArea = this.appletArea.addGraph(this.mem_size, this.panel_height);
            else
                memGraphArea = this.appletArea.addGraph(this.panel_height, this.mem_size);

            let memProvider =  new Providers.MemDataProvider();
            this.graphs.push(new Graph.Graph(memProvider, memGraphArea, this.theme_object, this.mem_show_detail_label));
        }
                
        // Add NET IN Graph
        if (this.netin_enable_graph) {
            let netInGraphArea = null;
            if (this.isHorizontal)
                netInGraphArea = this.appletArea.addGraph(this.netin_size, this.panel_height);
            else
                netInGraphArea = this.appletArea.addGraph(this.panel_height, this.netin_size);

            let netInProvider =  new Providers.NetDataProvider(this.frequency, true, this.netin_linlog, this.netin_speed);
            this.graphs.push(new Graph.Graph(netInProvider, netInGraphArea, this.theme_object, this.netin_show_detail_label));
        }    
                
        // Add NET OUT Graph
        if (this.netout_enable_graph) {
            let netOutGraphArea = null;
            if (this.isHorizontal)
                netOutGraphArea = this.appletArea.addGraph(this.netout_size, this.panel_height);
            else
                netOutGraphArea = this.appletArea.addGraph(this.panel_height, this.netout_size);

            let netOutProvider =  new Providers.NetDataProvider(this.frequency, false, this.netout_linlog, this.netout_speed);
            this.graphs.push(new Graph.Graph(netOutProvider, netOutGraphArea, this.theme_object, this.netout_show_detail_label));
        }    
                
        // Add DISK READ Graph
        if (this.diskread_enable_graph) {
            let diskReadGraphArea = null;
            if (this.isHorizontal)
                diskReadGraphArea = this.appletArea.addGraph(this.diskread_size, this.panel_height);
            else
                diskReadGraphArea = this.appletArea.addGraph(this.panel_height, this.diskread_size);

            let diskReadProvider =  new Providers.DiskDataProvider(this.frequency, true, this.diskread_mount_dir);
            this.graphs.push(new Graph.Graph(diskReadProvider, diskReadGraphArea, this.theme_object, this.diskread_show_detail_label));
        }    
                
        // Add DISK WRITE Graph
        if (this.diskwrite_enable_graph) { 
            let diskWriteGraphArea = null;
            if (this.isHorizontal)
                diskWriteGraphArea = this.appletArea.addGraph(this.diskwrite_size, this.panel_height);
            else
                diskWriteGraphArea = this.appletArea.addGraph(this.panel_height, this.diskwrite_size);

            let diskWriteProvider =  new Providers.DiskDataProvider(this.frequency, false, this.diskwrite_mount_dir);
            this.graphs.push(new Graph.Graph(diskWriteProvider, diskWriteGraphArea, this.theme_object, this.diskwrite_show_detail_label));
        }    

        this.appletArea.createDrawingArea();

        this.appletArea.drawingArea.connect('repaint', Lang.bind(this, this.onGraphRepaint));        
        this.actor.add_actor(this.appletArea.drawingArea);
    },

    updateAppletArea: function() {
        if (this.appletArea) {
            this.appletArea.destroyDrawingArea();
            this.appletArea = null;
        }

        this.createAppletArea();
    },

    getOrientation: function (orientation) {
        this.orientation = orientation;
        if (this.versionCompare( GLib.getenv('CINNAMON_VERSION') ,"3.2" ) >= 0 ){
            if (this.orientation == St.Side.LEFT || this.orientation == St.Side.RIGHT) {                 
                this.isHorizontal = false;  // vertical
            } else {                 
                this.isHorizontal = true;   // horizontal
            }
        } else {
            this.isHorizontal = true;  // Do not check unless >= 3.2
        }
    },

    on_orientation_changed: function(orientation) {
        this.getOrientation(orientation);
        this.updateAppletArea();
    },

    on_panel_height_changed: function() {  
        this.panel_height = this._panelHeight
        this.updateAppletArea();
        this._update();
    },

    on_applet_removed_from_panel: function() {
        if (gtopFailed) return;
        this.removeUpdateLoop();
    },

    on_applet_clicked: function(event) {
        this._runSysMon();
    },

    addUpdateLoop: function(frequency) {
        // Start the update loop and allow updates
        this.loopId = Mainloop.timeout_add(frequency*1000, Lang.bind(this, this.update));
        this.shouldUpdate = true;
    },

    removeUpdateLoop: function() {
        // Remove the update loop and stop updates
        if (this.loopId) {
            Mainloop.source_remove(this.loopId);
        }
        this.shouldUpdate = false;
    },

    update: function() {
        Mainloop.idle_add_full(Mainloop.PRIORITY_LOW, () => this._update());
        return this.shouldUpdate;
    },

    _update: function() {
    	for (let i = 0; i < this.graphs.length; i++) {
            this.graphs[i].refreshData();
        }
        this.appletArea.drawingArea.queue_repaint();
    },

    // Redraws the graphs
    onGraphRepaint: function (area) {
        let [width, height] = [0,0];

        for (let index = 0; index < this.graphs.length; index++) {
            if (this.isHorizontal)
                area.get_context().translate(width, 0);
            else
                area.get_context().translate(0, height);

            this.graphs[index].paint(area);

            if (this.isHorizontal)
                width = this.appletArea.graphArea[index].width
            else
                height = this.appletArea.graphArea[index].height;            
        }
    },

    // Called when the settings have changed
    settingsChanged: function () {        
        this.restartGHW();
    },

    // Gets color on format 'rgba(255,255,255,0.5) and returns an array of four values
    getColors:function (rgb) {
        let colors = rgb.replace(/[^\d,]/g, '').split(',');
        for(let i=0;i<3;i++) {
            colors[i] /= 255;
        }

        return colors;
    },

    // Creates an object containing the users selected theme settings
    createThemeObject: function() {
        this.theme_object = new Object();
        this.theme_object.theme = this.theme;
        this.theme_object.border_colors = this.getColors(this.border_color);
        this.theme_object.background_colors1 = this.getColors(this.background_color1);
        this.theme_object.background_colors2 = this.getColors(this.background_color2);
        this.theme_object.label_color = this.getColors(this.label_color);
        this.theme_object.label_size = this.label_size;
        this.theme_object.detail_label_color = this.getColors(this.detail_label_color);
        this.theme_object.detail_label_size = this.detail_label_size;
        this.theme_object.theme_data = this.theme_data;
        this.theme_object.graph_color1 = this.getColors(this.graph_color1);
        this.theme_object.graph_color2 = this.getColors(this.graph_color2);
        this.theme_object.graph_color3 = this.getColors(this.graph_color3);
        this.theme_object.graph_color4 = this.getColors(this.graph_color4);
        this.theme_object.graph_offset2 = this.graph_offset2;
        this.theme_object.graph_offset3 = this.graph_offset3;
        this.theme_object.cpu_use_custom_label = this.cpu_use_custom_label;
        this.theme_object.cpu_custom_label = this.cpu_custom_label;
        this.theme_object.mem_use_custom_label = this.mem_use_custom_label;
        this.theme_object.mem_custom_label = this.mem_custom_label;
        this.theme_object.netin_use_custom_label = this.netin_use_custom_label;
        this.theme_object.netin_custom_label = this.netin_custom_label;
        this.theme_object.netout_use_custom_label = this.netout_use_custom_label;
        this.theme_object.netout_custom_label = this.netout_custom_label;
        this.theme_object.diskread_use_custom_label = this.diskread_use_custom_label;
        this.theme_object.diskread_custom_label = this.diskread_custom_label;
        this.theme_object.diskwrite_use_custom_label = this.diskwrite_use_custom_label;
        this.theme_object.diskwrite_custom_label = this.diskwrite_custom_label;
    },

    restartGHW: function() {
        // Refresh the update loop with the new frequency
        this.createThemeObject();
        this.removeUpdateLoop();
        this.addUpdateLoop(this.frequency);
        this.updateAppletArea();        
    },

    _runSysMon: function() {
    	let _appSys = Cinnamon.AppSystem.get_default();
    	let _gsmApp = _appSys.lookup_app('gnome-system-monitor.desktop');
    	_gsmApp.activate();
    },
    
    _runSysMonActivate: function() {
        this._runSysMon();
    },
    
    // Compare two version numbers (strings) based on code by Alexey Bass (albass)
    // Takes account of many variations of version numers including cinnamon.
    versionCompare: function(left, right) {
        if (typeof left + typeof right != 'stringstring')
            return false;
        var a = left.split('.'),
            b = right.split('.'),
            i = 0,
            len = Math.max(a.length, b.length);
        for (; i < len; i++) {
            if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
                return 1;
            } else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
                return -1;
            }
        }
        return 0;
    }
};

function main(metadata, orientation, panel_height, instance_id) {
    return new GraphicalHWMonitorApplet(metadata, orientation, panel_height, instance_id);
}
