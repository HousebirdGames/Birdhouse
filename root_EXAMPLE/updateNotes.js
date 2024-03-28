/*
    This is an example file for the update notes. It is used to demonstrate the structure of the update notes data.

    
    Update notes are used to inform users about the changes in the application with each version update and
    will be displayed in the application in a popup when a new version is activated. You can disable this feature
    by setting the `showNewUpdateNotes` property to false in the `config.js` file.
*/

export const updateNotes = [
    {
        "version": "1.0.0",
        "title": "The first release version",
        "notes": [
            "Update note 1",
            "Update note 2",
            "Update note 3",
            "Update note 4",
            "Update note 5",
        ]
    },
    {
        "version": "0.9.0",
        "title": "The beta version",
        "notes": [
            "Update note 1",
            "Update note 2",
            "Update note 3",
        ]
    },
    {
        "version": "0.8.0",
        "title": "The alpha version",
        "notes": [
            "Update note 1",
            "Update note 2",
            "Update note 3",
            "Update note 4",
        ]
    }
];  