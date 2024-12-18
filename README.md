# Quick Links Plugin for Joplin 

This Plugin for the note taking app [Joplin](https://joplinapp.org/) gives you a quicker way to add Links to other notes.

**The plugin is working only in the Markdown editor. The WYSIWG editor is not supported**

## How to use

Type `@@` anywhere in your note and select the note to link in the drop down menu.

## How to install

From Joplin desktop open Options - Plugins, search for "quick links" and install.


# Developing on the plugin

The main two files you will want to look at are:

- `/src/index.ts`, which contains the entry point for the plugin source code.
- `/src/manifest.json`, which is the plugin manifest. It contains information such as the plugin a name, version, etc.

## Building the plugin

The plugin is built using Webpack, which creates the compiled code in `/dist`. A JPL archive will also be created at the root, which can be used to distribute the plugin.

To build the plugin, simply run `npm run dist`.

The project is setup to use TypeScript, although you can change the configuration to use plain JavaScript.

## Updating the plugin framework

To update the plugin framework, run `npm run update`.

In general this command tries to do the right thing - in particular it's going to merge the changes in package.json and .gitignore instead of overwriting. It will also leave "/src" as well as README.md untouched.

The file that may cause problem is "webpack.config.js" because it's going to be overwritten. For that reason, if you want to change it, consider creating a separate JavaScript file and include it in webpack.config.js. That way, when you update, you only have to restore the line that include your file.
